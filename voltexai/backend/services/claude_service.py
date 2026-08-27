"""
VoltexAI - Claude API service
Wraps the Anthropic SDK for the four modes (Terminal / Analysis / Signals / Academy)
with streaming, vision (chart image analysis), and token accounting.
"""
from __future__ import annotations
import base64
import json
import logging
from typing import AsyncGenerator, Optional

from anthropic import AsyncAnthropic, APIError, RateLimitError, AuthenticationError

from ..config import settings
from ..prompts.trading_prompts import get_system_prompt

logger = logging.getLogger(__name__)


class ClaudeService:
    """Stateless wrapper - state lives in DB conversations table."""

    def __init__(self):
        if not settings.ANTHROPIC_API_KEY:
            logger.warning("ANTHROPIC_API_KEY not set - AI calls will fail")
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.CLAUDE_MODEL
        self.max_tokens = settings.CLAUDE_MAX_TOKENS

    # ---------- internal ----------
    @staticmethod
    def _to_anthropic_messages(history: list[dict], new_user_msg: str,
                               image_b64: Optional[str] = None,
                               image_media_type: str = "image/png") -> list[dict]:
        """
        Convert our internal {role, content} list to Anthropic format.
        Optionally attach a base64 image to the latest user message (for chart analysis).
        """
        msgs = [{"role": m["role"], "content": m["content"]} for m in history]
        if image_b64:
            msgs.append({
                "role": "user",
                "content": [
                    {"type": "image",
                     "source": {"type": "base64",
                                "media_type": image_media_type,
                                "data": image_b64}},
                    {"type": "text", "text": new_user_msg or "Analyse this chart."},
                ],
            })
        else:
            msgs.append({"role": "user", "content": new_user_msg})
        return msgs

    # ---------- public, non-streaming ----------
    async def complete(self, mode: str, history: list[dict], user_message: str,
                       image_b64: Optional[str] = None,
                       image_media_type: str = "image/png") -> dict:
        """One-shot completion. Returns {content, tokens_in, tokens_out}."""
        try:
            resp = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=get_system_prompt(mode),
                messages=self._to_anthropic_messages(history, user_message,
                                                    image_b64, image_media_type),
            )
            text = "".join(b.text for b in resp.content if hasattr(b, "text"))
            return {
                "content": text,
                "tokens_in": resp.usage.input_tokens,
                "tokens_out": resp.usage.output_tokens,
                "model": self.model,
            }
        except AuthenticationError as e:
            logger.error("Anthropic auth failed: %s", e)
            raise
        except RateLimitError as e:
            logger.warning("Anthropic rate-limited: %s", e)
            raise
        except APIError as e:
            logger.error("Anthropic API error: %s", e)
            raise

    # ---------- public, streaming (SSE for the terminal UI) ----------
    async def stream(self, mode: str, history: list[dict], user_message: str,
                     image_b64: Optional[str] = None,
                     image_media_type: str = "image/png"
                     ) -> AsyncGenerator[str, None]:
        """Yields Server-Sent-Event lines. Final event carries usage stats."""
        try:
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=self.max_tokens,
                system=get_system_prompt(mode),
                messages=self._to_anthropic_messages(history, user_message,
                                                    image_b64, image_media_type),
            ) as stream:
                async for text_chunk in stream.text_stream:
                    payload = json.dumps({"type": "delta", "text": text_chunk})
                    yield f"data: {payload}\n\n"
                final = await stream.get_final_message()
                done = json.dumps({
                    "type": "done",
                    "tokens_in": final.usage.input_tokens,
                    "tokens_out": final.usage.output_tokens,
                })
                yield f"data: {done}\n\n"
        except (APIError, AuthenticationError, RateLimitError) as e:
            err = json.dumps({"type": "error", "message": str(e)})
            yield f"data: {err}\n\n"

    # ---------- specialised: signal generator (forces JSON) ----------
    async def generate_signal(self, pair: str, timeframe: str = "M15",
                              extra_context: str = "") -> dict:
        """Used by /api/signals - asks Claude for a JSON-only signal."""
        user_msg = (
            f"Generate a trading signal for {pair} on the {timeframe} timeframe. "
            f"Current session context: {extra_context or 'use the most recent session.'}\n"
            "Respond with the strict JSON schema only - no markdown."
        )
        resp = await self.complete("signals", history=[], user_message=user_msg)
        content = resp["content"].strip()
        # Strip possible code fences just in case
        if content.startswith("```"):
            content = content.strip("`")
            if content.lower().startswith("json"):
                content = content[4:].strip()
        try:
            signal = json.loads(content)
        except json.JSONDecodeError:
            signal = {"pair": pair, "direction": "NO_TRADE",
                      "reason": "AI returned non-JSON output", "raw": content[:500]}
        return {"signal": signal,
                "tokens_in": resp["tokens_in"], "tokens_out": resp["tokens_out"]}


    # ---------- specialised: plain-language rationale for a deterministic signal ----------
    async def signal_rationale(self, sig: dict) -> Optional[str]:
        """Write a concise, plain-language rationale for an already-computed signal.
        Returns None when no key is configured so the caller can use the
        deterministic fallback. The numbers come from the engine — Claude only
        explains them, it never invents levels."""
        if not settings.ANTHROPIC_API_KEY:
            return None
        facts = {k: sig.get(k) for k in (
            "symbol", "display", "timeframe", "direction", "grade", "quality",
            "entry", "stop_loss", "tp1", "tp2", "tp3", "risk_reward_tp1",
            "confluence_factors", "session_context", "indicators")}
        prompt = (
            "You are the VoltexAI desk analyst. Explain this ALREADY-COMPUTED signal "
            "to a trader in 2-3 short sentences: why the setup is valid, what confirms "
            "it, and the key risk. Do NOT invent or change any price/level — use only "
            "what is given. Plain language, no markdown, end with a one-line risk note.\n\n"
            f"SIGNAL JSON:\n{json.dumps(facts, default=str)}"
        )
        try:
            resp = await self.complete("analysis", history=[], user_message=prompt)
            return (resp.get("content") or "").strip() or None
        except (APIError, AuthenticationError, RateLimitError):
            return None


# Singleton
claude_service = ClaudeService()
