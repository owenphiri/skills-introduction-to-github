//+------------------------------------------------------------------+
//|                                   AXION_SyntheticReverter_v2.mq5 |
//|                                        Copyright Axion Labs Ltd. |
//|                                             https://owensfx.com  |
//+------------------------------------------------------------------+
//| AXION SYNTHETIC REVERTER v2.0                                    |
//|                                                                  |
//| Pure price-action statistical mean-reversion Expert Advisor for  |
//| Deriv synthetic indices (Volatility 10/25/50/75/100, Step Index, |
//| Boom 1000, Crash 1000).                                          |
//|                                                                  |
//| Synthetics are algorithmically generated: there is no            |
//| institutional order flow, no sessions, no news. The only         |
//| exploitable edge is statistical overextension followed by        |
//| reversion to the rolling mean, protected by ruthless risk        |
//| management. No ICT/SMC, no order blocks, no liquidity concepts.  |
//|                                                                  |
//| HARD CONSTRAINTS (enforced by design):                           |
//|  - No martingale, no grid, no averaging down, no hedging.        |
//|  - One position per symbol maximum (InpMaxOpenTrades).           |
//|  - All risk calculations from EQUITY, never balance.             |
//|  - All chart objects prefixed AXN_ and deleted on deinit.        |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Axion Labs Ltd."
#property link      "https://owensfx.com"
#property version   "2.00"
#property description "AXION Synthetic Reverter v2.0 - statistical mean-reversion EA for Deriv synthetic indices."
#property description "Triple-confluence entry: ATR range expansion + rejection wick + std-dev stretch."

//+------------------------------------------------------------------+
//| PHASE 0 - PROJECT SETUP & CONSTANTS                              |
//+------------------------------------------------------------------+
#include <Trade\Trade.mqh>

CTrade trade;                              // trade execution wrapper

// ---- Brand constants (Axion palette) ------------------------------
#define CLR_NAVY        C'10,22,40'        // #0A1628 - panel background
#define CLR_NAVY_SOFT   C'26,42,66'        // lightened navy - target zone fill (MT5 objects have no alpha; this approximates ~15% opacity on a dark chart)
#define CLR_GOLD        C'201,168,76'      // #C9A84C - headers / TP lines
#define AXN_PREFIX      "AXN_"             // every chart object starts with this
#define AXN_DASH        "AXN_DASH_"        // dashboard objects
#define AXN_TRD         "AXN_TRD_"         // live-trade objects (deleted when the trade closes)
#define AXN_HIST        "AXN_HIST_"        // closed-trade history markers (ring buffer)

// ---- Enumerations (must precede the inputs that use them) ---------
enum ENUM_TP_MODE
  {
   TP_MEAN   = 0,                          // Single TP at rolling mean
   TP_TIERED = 1                           // TP1/TP2/TP3 partial-close ladder
  };

enum ENUM_TRAIL_MODE
  {
   TRAIL_OFF = 0,                          // No trailing
   TRAIL_ATR = 1                           // ATR-distance trailing after break-even
  };

//+------------------------------------------------------------------+
//| PHASE 1 - INPUT PARAMETERS                                       |
//+------------------------------------------------------------------+
input group "=== 0. Identity ==="
input long              InpMagic              = 20260710;   // Magic number - unique EA identity (change per chart instance)

input group "=== 1. Entry Engine ==="
input int               InpATRPeriod          = 14;         // ATR baseline period (10-21 sane; volatility yardstick)
input double            InpRangeExpansionMult = 1.8;        // Candle range must exceed ATR x this (1.5-2.5; overextension trigger)
input double            InpMinWickPct         = 60.0;       // Rejection wick >= this % of candle range (50-75; proof of rejection)
input int               InpMeanPeriod         = 50;         // SMA period of typical price (30-100; the reversion anchor)
input int               InpStdDevPeriod       = 50;         // StdDev period (match InpMeanPeriod; measures the stretch)
input double            InpMinStdDevs         = 2.0;        // Min std-devs from mean (1.5-3.0; statistical overextension gate)
input int               InpVolRegimeBars      = 500;        // ATR history depth for percentile regime filter (300-1000)
input double            InpVolRegimeLowPct    = 30.0;       // Lower ATR percentile bound (skip dead volatility)
input double            InpVolRegimeHighPct   = 70.0;       // Upper ATR percentile bound (skip volatility explosions)

input group "=== 2. Risk Engine ==="
input double            InpRiskPercent        = 0.5;        // Equity % risked per trade (0.25-1.0; NEVER balance-based)
input double            InpDailyLossCapPct    = 2.0;        // Daily loss cap % of day-start equity - halts new entries
input double            InpMaxDrawdownPct     = 5.0;        // Hard halt: drawdown % from equity high-water mark
input int               InpMaxConsecLosses    = 3;          // Consecutive losses before circuit breaker (2-5)
input double            InpCooldownHours      = 4.0;        // Cooldown hours after consecutive-loss breaker fires
input int               InpMaxOpenTrades      = 1;          // Max simultaneous positions on this symbol (keep at 1)
input int               InpMaxSpreadPoints    = 50;         // Skip entries when spread exceeds this many points

input group "=== 3. Exit Engine ==="
input double            InpSLAtrBuffer        = 0.5;        // SL = beyond extreme wick + ATR x this buffer (0.3-1.0)
input ENUM_TP_MODE      InpTPMode             = TP_MEAN;    // TP mode: mean reversion target or tiered ladder
input double            InpTP1Pct             = 50.0;       // Tiered: % of volume closed at TP1
input double            InpTP2Pct             = 30.0;       // Tiered: % of volume closed at TP2
input double            InpTP3Pct             = 20.0;       // Tiered: % of volume left to run to TP3 (documentation only; remainder runs)
input double            InpBETriggerPct       = 50.0;       // Move SL to BE+spread when this % of TP distance is covered
input ENUM_TRAIL_MODE   InpTrailMode          = TRAIL_ATR;  // Trailing mode (only engages after break-even)
input double            InpTrailAtrMult       = 1.5;        // Trail distance = ATR x this (1.0-2.5)
input int               InpTrailStepPoints    = 10;         // Min improvement in points before SL is re-sent (reduces modify spam)

input group "=== 4. Visual Engine ==="
input bool              InpShowVisuals        = true;       // Master visual toggle (auto-forced OFF during optimization)
input int               InpTradeHistoryDepth  = 20;         // Closed-trade markers kept on chart (ring buffer)
input int               InpFontSize           = 9;          // Label font size
input color             InpColorText          = clrWhite;   // Dashboard/body text color
input color             InpColorHeader        = CLR_GOLD;   // Header / TP accent color (brand gold)

input group "=== 5. Journal & Dashboard ==="
input bool              InpEnableJournal      = true;       // Write CSV trade journal to MQL5\Files
input string            InpJournalFileName    = "AXN_TradeJournal.csv"; // Journal file name
input bool              InpShowDashboard      = true;       // Show on-chart statistics dashboard

//+------------------------------------------------------------------+
//| PHASE 2 - GLOBAL STATE                                           |
//+------------------------------------------------------------------+
// ---- Indicator handles --------------------------------------------
int      g_hATR    = INVALID_HANDLE;       // ATR(InpATRPeriod)
int      g_hMean   = INVALID_HANDLE;       // SMA(InpMeanPeriod) of typical price - reversion anchor
int      g_hStdDev = INVALID_HANDLE;       // StdDev(InpStdDevPeriod) of typical price - stretch yardstick

// ---- Persistence (GlobalVariables survive terminal restarts) ------
// Keys are namespaced by magic + symbol so multiple charts never collide.
string   g_gvHWM      = "";                // equity high-water mark
string   g_gvCooldown = "";                // cooldown-until unix timestamp
string   g_gvConsec   = "";                // consecutive-loss counter

double   g_hwm            = 0.0;           // equity high-water mark
datetime g_cooldownUntil  = 0;             // no entries before this time
int      g_consecLosses   = 0;             // current consecutive-loss streak

// ---- Daily tracking ------------------------------------------------
int      g_dayStamp       = 0;             // yyyymmdd of the tracked day (midnight reset detector)
double   g_dayStartEquity = 0.0;           // equity snapshot at day start (daily-cap denominator)
double   g_dayRealized    = 0.0;           // realized P/L accumulated today (this magic only)
int      g_tradesToday    = 0;             // entries opened today

// ---- Halt flags (one-time alerting) --------------------------------
bool     g_ddAlerted      = false;         // drawdown-halt alert already printed
bool     g_dailyAlerted   = false;         // daily-cap alert already printed

// ---- Trade plan -----------------------------------------------------
struct TradePlan
  {
   int      direction;                     // +1 buy, -1 sell
   double   entry;                         // intended entry price
   double   sl;                            // stop loss
   double   tp1;                           // tier 1 (== final TP in TP_MEAN mode)
   double   tp2;                           // tier 2
   double   tp3;                           // tier 3 / final
   double   lots;                          // risk-derived volume
   string   confluenceTag;                 // e.g. "ATR-EXPx1.9 + WICK64% + 2.3SD"
  };
TradePlan g_plan;                          // plan for the trade being built this bar

// ---- Managed-position runtime state (single position by design) ----
struct ManagedPos
  {
   ulong    ticket;                        // position ticket (0 = none tracked)
   int      direction;                     // +1 buy, -1 sell
   double   entry;                         // open price
   double   initialSL;                     // SL at entry (for visuals/journal)
   double   tp1, tp2, tp3;                 // tier prices (tp3 == final)
   double   initialLots;                   // volume at entry
   bool     tp1Done, tp2Done;              // tier fill flags
   bool     beDone;                        // break-even applied
   bool     trailOn;                       // trailing engaged
   double   lastTrailSL;                   // last trail level sent
   int      ghostCount;                    // ghost-trail marker counter
   string   confluenceTag;                 // copied from plan for journal/visuals
   datetime openTime;                      // open time for journal
  };
ManagedPos g_pos;                          // runtime state; rebuilt best-effort after restart

// ---- Journal pending record ----------------------------------------
// JournalOpen() writes an OPEN stub row immediately (crash-safe audit);
// JournalClose() appends the completed row with exit data.
bool     g_journalPending = false;

// ---- Dashboard statistics ------------------------------------------
int      g_statTotal      = 0;             // closed trades this session
int      g_statWins       = 0;
int      g_statLosses     = 0;
double   g_statGrossProfit = 0.0;
double   g_statGrossLoss   = 0.0;          // stored positive
string   g_lastTag        = "-";           // last confluence tag (dashboard row)

// ---- Dashboard redraw cache (only touch objects whose text changed)
string   g_dashCache[8];

// ---- Runtime visual switch (inputs are const; optimization forces off)
bool     g_visuals   = true;
int      g_histIdx   = 0;                  // ring-buffer cursor for closed-trade markers

//+------------------------------------------------------------------+
//| Small utilities                                                  |
//+------------------------------------------------------------------+
bool IsBoom(void)  { return(StringFind(_Symbol, "Boom")  >= 0); }
bool IsCrash(void) { return(StringFind(_Symbol, "Crash") >= 0); }

int TodayStamp(void)
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return(dt.year * 10000 + dt.mon * 100 + dt.day);
  }

double SpreadPrice(void)
  {
   return((double)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) * _Point);
  }

// Normalise a volume to broker constraints; returns 0 if below min lot.
double NormalizeLots(double lots)
  {
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   if(step <= 0.0)
      step = 0.01;
   lots = MathFloor(lots / step + 1e-9) * step;
   if(lots > vmax)
      lots = vmax;
   if(lots < vmin)
      return(0.0);
   return(NormalizeDouble(lots, 8));
  }

// Copy one value from an indicator buffer; false on failure (guards
// against out-of-range access on unfinished buffers).
bool BufferValue(const int handle, const int shift, double &value)
  {
   double buf[1];
   if(CopyBuffer(handle, 0, shift, 1, buf) != 1)
      return(false);
   value = buf[0];
   return(value != EMPTY_VALUE);
  }

//+------------------------------------------------------------------+
//| PHASE 3 - OnInit                                                 |
//+------------------------------------------------------------------+
int OnInit(void)
  {
   // 1. Indicator handles ------------------------------------------------
   g_hATR    = iATR(_Symbol, _Period, InpATRPeriod);
   g_hMean   = iMA(_Symbol, _Period, InpMeanPeriod, 0, MODE_SMA, PRICE_TYPICAL);
   g_hStdDev = iStdDev(_Symbol, _Period, InpStdDevPeriod, 0, MODE_SMA, PRICE_TYPICAL);
   if(g_hATR == INVALID_HANDLE || g_hMean == INVALID_HANDLE || g_hStdDev == INVALID_HANDLE)
     {
      Print("AXION: failed to create indicator handles - aborting init.");
      return(INIT_FAILED);
     }

   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(30);
   trade.SetTypeFillingBySymbol(_Symbol);

   // 2. Restore persisted state -----------------------------------------
   string ns = StringFormat("AXN_%I64d_%s_", InpMagic, _Symbol);
   g_gvHWM      = ns + "HWM";
   g_gvCooldown = ns + "COOLDOWN";
   g_gvConsec   = ns + "CONSEC";

   g_hwm = GlobalVariableCheck(g_gvHWM) ? GlobalVariableGet(g_gvHWM)
                                        : AccountInfoDouble(ACCOUNT_EQUITY);
   g_cooldownUntil = GlobalVariableCheck(g_gvCooldown) ? (datetime)(long)GlobalVariableGet(g_gvCooldown) : 0;
   g_consecLosses  = GlobalVariableCheck(g_gvConsec)   ? (int)GlobalVariableGet(g_gvConsec)              : 0;

   // Day tracking starts fresh on attach.
   g_dayStamp       = TodayStamp();
   g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   g_dayRealized    = 0.0;
   g_tradesToday    = 0;

   ZeroMemory(g_pos);
   RecoverOpenPositionState();             // best-effort re-attach to an existing position

   // 3. Journal header ----------------------------------------------------
   if(InpEnableJournal && !FileIsExist(InpJournalFileName))
     {
      int fh = FileOpen(InpJournalFileName, FILE_CSV | FILE_READ | FILE_WRITE | FILE_SHARE_READ | FILE_ANSI, ',');
      if(fh != INVALID_HANDLE)
        {
         FileWrite(fh, "Time", "Symbol", "Direction", "Entry", "SL", "TP", "Lots",
                   "ConfluenceTag", "ExitTime", "ExitPrice", "PL", "Result",
                   "BEActivated", "TrailActivated");
         FileClose(fh);
        }
      else
         Print("AXION: journal header write failed, error ", GetLastError());
     }

   // 4. Tester/optimization detection --------------------------------------
   g_visuals = InpShowVisuals;
   if((bool)MQLInfoInteger(MQL_OPTIMIZATION))
      g_visuals = false;                   // objects cost real time across thousands of passes

   // 5. Dashboard skeleton --------------------------------------------------
   for(int i = 0; i < 8; i++)
      g_dashCache[i] = "";
   if(g_visuals && InpShowDashboard)
      CreateDashboardSkeleton();

   // 6. Init summary ---------------------------------------------------------
   PrintFormat("AXION Synthetic Reverter v2.0 initialised on %s %s | magic=%I64d | risk=%.2f%% | HWM=%.2f | consecLosses=%d | cooldownUntil=%s",
               _Symbol, EnumToString(_Period), InpMagic, InpRiskPercent, g_hwm,
               g_consecLosses, (g_cooldownUntil > 0 ? TimeToString(g_cooldownUntil) : "none"));
   return(INIT_SUCCEEDED);
  }

// Re-attach to a position left open across a restart. Tier flags cannot be
// recovered exactly, so tiers already passed by price are marked filled and
// management continues from the live SL/TP.
void RecoverOpenPositionState(void)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol ||
         PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;

      g_pos.ticket      = ticket;
      g_pos.direction   = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? 1 : -1;
      g_pos.entry       = PositionGetDouble(POSITION_PRICE_OPEN);
      g_pos.initialSL   = PositionGetDouble(POSITION_SL);
      g_pos.initialLots = PositionGetDouble(POSITION_VOLUME);
      g_pos.tp3         = PositionGetDouble(POSITION_TP);
      g_pos.tp1         = g_pos.tp3;       // ladder geometry is lost; run remaining volume to final TP
      g_pos.tp2         = g_pos.tp3;
      g_pos.tp1Done     = true;
      g_pos.tp2Done     = true;
      double sl = PositionGetDouble(POSITION_SL);
      g_pos.beDone      = (sl != 0.0) &&
                          ((g_pos.direction > 0 && sl >= g_pos.entry) ||
                           (g_pos.direction < 0 && sl <= g_pos.entry));
      g_pos.lastTrailSL = sl;
      g_pos.confluenceTag = "RECOVERED";
      g_pos.openTime    = (datetime)PositionGetInteger(POSITION_TIME);
      PrintFormat("AXION: recovered open position #%I64u after restart (tier ladder reset, BE=%s).",
                  ticket, g_pos.beDone ? "yes" : "no");
      break;                               // single-position design
     }
  }

//+------------------------------------------------------------------+
//| PHASE 4 - OnTick MAIN LOOP (strict procedural pipeline)          |
//+------------------------------------------------------------------+
void OnTick(void)
  {
   // Step 1 - intrabar ticks only manage what is already open.
   if(!IsNewBar())
     {
      ManageOpenTrades();
      UpdateDashboard();
      return;
     }

   ManageOpenTrades();                     // manage on the bar-open tick too

   ResetDailyCountersIfNewDay();           // Step 2

   if(HaltedByDrawdownGuard())             // Step 3
     { UpdateDashboard(); return; }

   if(HaltedByDailyLossCap())              // Step 4
     { UpdateDashboard(); return; }

   if(InCooldown())                        // Step 5
     { UpdateDashboard(); return; }

   if(SpreadTooWide())                     // Step 6
     { UpdateDashboard(); return; }

   if(CountOpenTrades() >= InpMaxOpenTrades) // Step 7
     { UpdateDashboard(); return; }

   if(!VolRegimeOK())                      // Step 8
     { UpdateDashboard(); return; }

   int signal = CheckEntrySignal();        // Step 9
   if(signal == 0)                         // Step 10
     { UpdateDashboard(); return; }

   if(!BuildTradePlan(signal))             // Step 11
     { UpdateDashboard(); return; }

   if(!ValidateTradePlan())                // Step 12
     { UpdateDashboard(); return; }

   if(ExecuteTrade())                      // Step 13
     {
      JournalOpen();                       // Step 14
      DrawTradeVisuals();
     }
   UpdateDashboard();
  }

// New closed bar detector.
bool IsNewBar(void)
  {
   static datetime lastBarTime = 0;
   datetime t = iTime(_Symbol, _Period, 0);
   if(t == lastBarTime)
      return(false);
   lastBarTime = t;
   return(true);
  }

// Step 2 - midnight rollover resets the daily ledger.
void ResetDailyCountersIfNewDay(void)
  {
   int today = TodayStamp();
   if(today == g_dayStamp)
      return;
   g_dayStamp       = today;
   g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   g_dayRealized    = 0.0;
   g_tradesToday    = 0;
   g_dailyAlerted   = false;
   Print("AXION: new trading day - daily counters reset.");
  }

// Step 5 - consecutive-loss circuit breaker timer.
bool InCooldown(void)
  {
   return(TimeCurrent() < g_cooldownUntil);
  }

// Step 6 - execution-quality gate.
bool SpreadTooWide(void)
  {
   return((int)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) > InpMaxSpreadPoints);
  }

// Positions on this symbol carrying this magic.
int CountOpenTrades(void)
  {
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
         PositionGetInteger(POSITION_MAGIC) == InpMagic)
         count++;
     }
   return(count);
  }

// Step 8 - volatility regime filter: only trade when current ATR sits inside
// the [low, high] percentile band of its own recent distribution. Dead
// volatility -> no range to revert; exploding volatility -> reversion fails.
bool VolRegimeOK(void)
  {
   double atr[];
   ArraySetAsSeries(atr, true);
   int copied = CopyBuffer(g_hATR, 0, 1, InpVolRegimeBars, atr);
   if(copied < InpVolRegimeBars)
      return(false);                       // not enough history yet - stand down

   double current = atr[0];
   int below = 0;
   for(int i = 0; i < copied; i++)
      if(atr[i] <= current)
         below++;
   double percentile = 100.0 * below / copied;
   return(percentile >= InpVolRegimeLowPct && percentile <= InpVolRegimeHighPct);
  }

//+------------------------------------------------------------------+
//| PHASE 5 - ENTRY SIGNAL (AND-gate triple confluence)              |
//| Returns +1 buy, -1 sell, 0 none. All three conditions must fire  |
//| on the just-closed bar (index 1).                                |
//+------------------------------------------------------------------+
int CheckEntrySignal(void)
  {
   double high  = iHigh(_Symbol, _Period, 1);
   double low   = iLow(_Symbol, _Period, 1);
   double open  = iOpen(_Symbol, _Period, 1);
   double close = iClose(_Symbol, _Period, 1);

   double atr = 0.0, mean = 0.0, sd = 0.0;
   if(!BufferValue(g_hATR, 1, atr) || !BufferValue(g_hMean, 1, mean) || !BufferValue(g_hStdDev, 1, sd))
      return(0);
   if(atr <= 0.0 || sd <= 0.0)             // division-by-zero guards
      return(0);

   double range = high - low;
   if(range <= 0.0)
      return(0);

   // Condition A - range expansion: the bar must be an overextension event.
   double expansion = range / atr;
   if(expansion <= InpRangeExpansionMult)
      return(0);

   // Condition B - rejection wick at the extreme.
   double upperWick = high - MathMax(open, close);
   double lowerWick = MathMin(open, close) - low;
   double upperWickPct = 100.0 * upperWick / range;
   double lowerWickPct = 100.0 * lowerWick / range;
   bool sellWick = (upperWickPct >= InpMinWickPct && close <= open); // bearish or neutral close under a long upper wick
   bool buyWick  = (lowerWickPct >= InpMinWickPct && close >= open); // bullish or neutral close over a long lower wick

   // Condition C - statistical stretch, direction-locked: pure reversion,
   // never trend-follow. Above the mean -> SELL bias only; below -> BUY only.
   double stretch = (close - mean) / sd;   // signed sigma distance
   bool sellStretch = (stretch >=  InpMinStdDevs);
   bool buyStretch  = (stretch <= -InpMinStdDevs);

   int signal = 0;
   double wickPct = 0.0;
   if(sellWick && sellStretch)
     { signal = -1; wickPct = upperWickPct; }
   else if(buyWick && buyStretch)
     { signal = 1;  wickPct = lowerWickPct; }
   if(signal == 0)
      return(0);

   // Boom/Crash asymmetry rule: these indices spike in ONE structural
   // direction by construction (Boom spikes up out of a down-drift, Crash
   // spikes down out of an up-drift). Fading the drift side means standing
   // in front of the next spike, so only the post-spike reversion side is
   // allowed: Boom -> SELL after a spike-up; Crash -> BUY after a spike-down.
   if(IsBoom() && signal != -1)
      return(0);
   if(IsCrash() && signal != 1)
      return(0);

   // Confluence tag - shown on chart, dashboard and journal so every entry
   // is explainable after the fact.
   g_plan.confluenceTag = StringFormat("ATR-EXPx%.1f + WICK%.0f%% + %.1fSD",
                                       expansion, wickPct, MathAbs(stretch));

   // No martingale, no grid, no averaging: sizing is fixed-fractional from
   // equity and CountOpenTrades() caps exposure to a single position, so
   // there is no code path that can add to or double a losing trade.
   return(signal);
  }

//+------------------------------------------------------------------+
//| PHASE 6 - RISK & POSITION SIZING                                 |
//+------------------------------------------------------------------+

// Step 11 - convert the signal into a fully specified plan.
bool BuildTradePlan(const int signal)
  {
   double atr = 0.0, mean = 0.0;
   if(!BufferValue(g_hATR, 1, atr) || !BufferValue(g_hMean, 1, mean) || atr <= 0.0)
      return(false);

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   g_plan.direction = signal;
   g_plan.entry     = (signal > 0) ? ask : bid;

   // SL beyond the extreme wick plus an ATR buffer - outside the noise that
   // created the signal bar.
   double extreme = (signal > 0) ? iLow(_Symbol, _Period, 1) : iHigh(_Symbol, _Period, 1);
   g_plan.sl = (signal > 0) ? extreme - atr * InpSLAtrBuffer
                            : extreme + atr * InpSLAtrBuffer;

   // TP anchored on the rolling mean (the whole thesis is reversion to it).
   // Tiered mode ladders the path back to the mean at 1/3, 2/3 and full.
   double tpDist = mean - g_plan.entry;    // signed distance to the anchor
   if((signal > 0 && tpDist <= 0.0) || (signal < 0 && tpDist >= 0.0))
      return(false);                       // mean already behind price - stale signal
   if(InpTPMode == TP_MEAN)
     {
      g_plan.tp1 = mean;
      g_plan.tp2 = mean;
      g_plan.tp3 = mean;
     }
   else
     {
      g_plan.tp1 = g_plan.entry + tpDist / 3.0;
      g_plan.tp2 = g_plan.entry + tpDist * 2.0 / 3.0;
      g_plan.tp3 = mean;
     }

   double slDist = MathAbs(g_plan.entry - g_plan.sl);
   if(slDist <= 0.0)
      return(false);
   g_plan.lots = CalcLots(slDist);
   return(g_plan.lots > 0.0);
  }

// Fixed-fractional sizing from EQUITY (never balance).
double CalcLots(const double slDistance)
  {
   double equity    = AccountInfoDouble(ACCOUNT_EQUITY);
   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickValue <= 0.0 || tickSize <= 0.0 || _Point <= 0.0 || slDistance <= 0.0)
      return(0.0);                         // division-by-zero guards

   double valuePerPointPerLot = tickValue * (_Point / tickSize);
   double slPoints            = slDistance / _Point;
   double riskMoney           = equity * InpRiskPercent / 100.0;
   double lots                = riskMoney / (slPoints * valuePerPointPerLot);
   return(NormalizeLots(lots));
  }

// Step 3 - equity vs high-water mark. Blocks NEW entries only; open trades
// keep their own SL/TP protection and are never force-closed by this guard.
bool HaltedByDrawdownGuard(void)
  {
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(equity > g_hwm)
     {
      g_hwm = equity;
      GlobalVariableSet(g_gvHWM, g_hwm);
      g_ddAlerted = false;
     }
   if(g_hwm <= 0.0)
      return(false);
   double ddPct = (g_hwm - equity) / g_hwm * 100.0;
   if(ddPct >= InpMaxDrawdownPct)
     {
      if(!g_ddAlerted)
        {
         PrintFormat("AXION HALT: drawdown %.2f%% from high-water mark %.2f reached the %.2f%% limit. New entries blocked.",
                     ddPct, g_hwm, InpMaxDrawdownPct);
         g_ddAlerted = true;
        }
      return(true);
     }
   return(false);
  }

// Step 4 - realized + floating P/L for the day vs day-start equity.
bool HaltedByDailyLossCap(void)
  {
   double dayPL = g_dayRealized + FloatingPL();
   if(g_dayStartEquity <= 0.0)
      return(false);
   if(dayPL <= -(g_dayStartEquity * InpDailyLossCapPct / 100.0))
     {
      if(!g_dailyAlerted)
        {
         PrintFormat("AXION HALT: daily P/L %.2f breached the %.2f%% daily loss cap. No new entries until tomorrow.",
                     dayPL, InpDailyLossCapPct);
         g_dailyAlerted = true;
        }
      return(true);
     }
   return(false);
  }

// Floating P/L of this EA's positions on this symbol.
double FloatingPL(void)
  {
   double sum = 0.0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol ||
         PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;
      sum += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
     }
   return(sum);
  }

// Step 12 - broker feasibility: stops level, freeze level, volume, margin.
bool ValidateTradePlan(void)
  {
   double stopsLevel = (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;
   double slDist = MathAbs(g_plan.entry - g_plan.sl);
   double tpDist = MathAbs(g_plan.tp3 - g_plan.entry);
   if(slDist < stopsLevel || tpDist < stopsLevel)
     {
      PrintFormat("AXION: plan rejected - SL/TP inside broker stops level (%.1f pts).", stopsLevel / _Point);
      return(false);
     }

   if(g_plan.lots < SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN))
     {
      Print("AXION: plan rejected - risk-derived volume below broker minimum lot.");
      return(false);
     }

   ENUM_ORDER_TYPE type = (g_plan.direction > 0) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   double margin = 0.0;
   if(!OrderCalcMargin(type, _Symbol, g_plan.lots, g_plan.entry, margin))
     {
      Print("AXION: plan rejected - OrderCalcMargin failed, error ", GetLastError());
      return(false);
     }
   if(margin > AccountInfoDouble(ACCOUNT_MARGIN_FREE))
     {
      Print("AXION: plan rejected - insufficient free margin.");
      return(false);
     }
   return(true);
  }

// Step 13 - send the order; one retry on a requote/price-off rejection.
bool ExecuteTrade(void)
  {
   // Position TP is set to the FINAL target; tier partials are managed by
   // the EA itself in ManageOpenTrades().
   bool sent = false;
   for(int attempt = 0; attempt < 2 && !sent; attempt++)
     {
      double price = (g_plan.direction > 0) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                            : SymbolInfoDouble(_Symbol, SYMBOL_BID);
      if(g_plan.direction > 0)
         sent = trade.Buy(g_plan.lots, _Symbol, price, g_plan.sl, g_plan.tp3, "AXN " + g_plan.confluenceTag);
      else
         sent = trade.Sell(g_plan.lots, _Symbol, price, g_plan.sl, g_plan.tp3, "AXN " + g_plan.confluenceTag);

      if(!sent)
        {
         uint rc = trade.ResultRetcode();
         if(rc == TRADE_RETCODE_REQUOTE || rc == TRADE_RETCODE_PRICE_CHANGED || rc == TRADE_RETCODE_PRICE_OFF)
           {
            PrintFormat("AXION: requote (retcode %u), retrying once at fresh price.", rc);
            continue;
           }
         PrintFormat("AXION: order failed, retcode %u (%s).", rc, trade.ResultComment());
         return(false);
        }
     }
   if(!sent)
      return(false);

   // Bind runtime management state to the new position. The position id
   // comes from the executed deal (CTrade exposes no position accessor).
   ZeroMemory(g_pos);
   ulong deal = trade.ResultDeal();
   if(deal > 0 && HistoryDealSelect(deal))
      g_pos.ticket = (ulong)HistoryDealGetInteger(deal, DEAL_POSITION_ID);
   if(g_pos.ticket == 0)
      g_pos.ticket = trade.ResultOrder();  // fallback: market order id == position id
   g_pos.direction     = g_plan.direction;
   g_pos.entry         = trade.ResultPrice() > 0.0 ? trade.ResultPrice() : g_plan.entry;
   g_pos.initialSL     = g_plan.sl;
   g_pos.tp1           = g_plan.tp1;
   g_pos.tp2           = g_plan.tp2;
   g_pos.tp3           = g_plan.tp3;
   g_pos.initialLots   = g_plan.lots;
   g_pos.confluenceTag = g_plan.confluenceTag;
   g_pos.openTime      = TimeCurrent();
   g_pos.lastTrailSL   = g_plan.sl;

   g_tradesToday++;
   g_lastTag = g_plan.confluenceTag;
   PrintFormat("AXION ENTRY: %s %.2f lots @ %.5f | SL %.5f | TP %.5f | %s",
               g_pos.direction > 0 ? "BUY" : "SELL", g_pos.initialLots,
               g_pos.entry, g_pos.initialSL, g_pos.tp3, g_pos.confluenceTag);
   return(true);
  }

//+------------------------------------------------------------------+
//| PHASE 7 - TRADE MANAGEMENT (every tick, positions matching magic)|
//+------------------------------------------------------------------+
void ManageOpenTrades(void)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol ||
         PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;

      if(g_pos.ticket != ticket)           // position appeared outside our state (rare) - adopt it
        {
         g_pos.ticket = ticket;
         RecoverOpenPositionState();
        }

      double bid   = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask   = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double price = (g_pos.direction > 0) ? bid : ask;   // exit-relevant side
      double curSL = PositionGetDouble(POSITION_SL);
      double curTP = PositionGetDouble(POSITION_TP);
      double vol   = PositionGetDouble(POSITION_VOLUME);

      // 1. Tiered TP partial closes -------------------------------------
      if(InpTPMode == TP_TIERED)
        {
         if(!g_pos.tp1Done && TierTouched(price, g_pos.tp1))
           {
            if(PartialClose(ticket, vol, InpTP1Pct))
              {
               g_pos.tp1Done = true;
               MarkTierFilled("TP1");
              }
           }
         else if(g_pos.tp1Done && !g_pos.tp2Done && TierTouched(price, g_pos.tp2))
           {
            if(!PositionSelectByTicket(ticket))
               continue;                   // fully closed by the partial (volume floor)
            vol = PositionGetDouble(POSITION_VOLUME);
            if(PartialClose(ticket, vol, InpTP2Pct * 100.0 / MathMax(100.0 - InpTP1Pct, 1.0)))
              {
               g_pos.tp2Done = true;
               MarkTierFilled("TP2");
              }
           }
         // TP3 runs to the position TP set at entry - no action needed.
        }

      if(!PositionSelectByTicket(ticket))
         continue;                         // position gone after a partial
      curSL = PositionGetDouble(POSITION_SL);

      // 2. Break-even ------------------------------------------------------
      if(!g_pos.beDone)
        {
         double tpDist = MathAbs(g_pos.tp3 - g_pos.entry);
         if(tpDist > 0.0)
           {
            double covered = (g_pos.direction > 0) ? (price - g_pos.entry) : (g_pos.entry - price);
            if(covered / tpDist * 100.0 >= InpBETriggerPct)
              {
               double bePrice = (g_pos.direction > 0) ? g_pos.entry + SpreadPrice()
                                                      : g_pos.entry - SpreadPrice();
               bool improves = (g_pos.direction > 0) ? (bePrice > curSL) : (curSL == 0.0 || bePrice < curSL);
               if(improves && trade.PositionModify(ticket, NormalizeDouble(bePrice, _Digits), curTP))
                 {
                  g_pos.beDone      = true;
                  g_pos.lastTrailSL = bePrice;
                  DrawBreakEvenVisuals(bePrice);
                  PrintFormat("AXION BE: position #%I64u risk-free at %.5f.", ticket, bePrice);
                 }
              }
           }
        }

      // 3. ATR trailing (only once risk-free) ------------------------------
      if(g_pos.beDone && InpTrailMode == TRAIL_ATR)
        {
         double atr = 0.0;
         if(BufferValue(g_hATR, 1, atr) && atr > 0.0)
           {
            double candidate = (g_pos.direction > 0) ? price - atr * InpTrailAtrMult
                                                     : price + atr * InpTrailAtrMult;
            double improvement = (g_pos.direction > 0) ? candidate - g_pos.lastTrailSL
                                                       : g_pos.lastTrailSL - candidate;
            bool beatsCurrent  = (g_pos.direction > 0) ? candidate > curSL : candidate < curSL;
            if(beatsCurrent && improvement >= InpTrailStepPoints * _Point)
              {
               if(trade.PositionModify(ticket, NormalizeDouble(candidate, _Digits), curTP))
                 {
                  g_pos.trailOn     = true;
                  DrawTrailVisuals(g_pos.lastTrailSL, candidate);
                  g_pos.lastTrailSL = candidate;
                 }
              }
           }
        }
     }
   // 4. Close detection lives in OnTradeTransaction (Phase 7.4).
  }

bool TierTouched(const double price, const double tier)
  {
   return((g_pos.direction > 0) ? (price >= tier) : (price <= tier));
  }

// Partially close pct% of the CURRENT volume, respecting min-lot and lot-step;
// skips (returns false) when the remainder would be untradeable dust.
bool PartialClose(const ulong ticket, const double currentVol, const double pct)
  {
   double vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double part = NormalizeLots(currentVol * pct / 100.0);
   if(part <= 0.0)
      return(false);
   if(currentVol - part < vmin)            // remainder would violate min lot -> let TP3 close it all
      return(false);
   return(trade.PositionClosePartial(ticket, part));
  }

//+------------------------------------------------------------------+
//| Close detection - journal, stats, streak & visuals               |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;
   if(!HistoryDealSelect(trans.deal))
      return;
   if(HistoryDealGetInteger(trans.deal, DEAL_MAGIC) != InpMagic)
      return;
   if(HistoryDealGetString(trans.deal, DEAL_SYMBOL) != _Symbol)
      return;

   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY)
      return;                              // only exits matter here

   double profit = HistoryDealGetDouble(trans.deal, DEAL_PROFIT)
                 + HistoryDealGetDouble(trans.deal, DEAL_SWAP)
                 + HistoryDealGetDouble(trans.deal, DEAL_COMMISSION);
   g_dayRealized += profit;

   ulong posId = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
   bool fullyClosed = !PositionSelectByTicket(posId);
   if(!fullyClosed)
      return;                              // partial close - tier visuals already updated

   // Full close: finalize stats, journal, streak and markers.
   double exitPrice = HistoryDealGetDouble(trans.deal, DEAL_PRICE);
   datetime exitTime = (datetime)HistoryDealGetInteger(trans.deal, DEAL_TIME);

   // For tiered exits the LAST deal's profit is only part of the story;
   // sum every OUT deal of this position for the true realized result.
   double totalPL = PositionRealizedPL(posId);

   g_statTotal++;
   if(totalPL > 0.0)
     {
      g_statWins++;
      g_statGrossProfit += totalPL;
      g_consecLosses = 0;                  // a win resets the streak
     }
   else if(totalPL < 0.0)
     {
      g_statLosses++;
      g_statGrossLoss += -totalPL;
      g_consecLosses++;
      if(g_consecLosses >= InpMaxConsecLosses)
        {
         g_cooldownUntil = TimeCurrent() + (int)(InpCooldownHours * 3600.0);
         GlobalVariableSet(g_gvCooldown, (double)(long)g_cooldownUntil);
         PrintFormat("AXION COOLDOWN: %d consecutive losses - no entries until %s.",
                     g_consecLosses, TimeToString(g_cooldownUntil));
        }
     }
   // totalPL == 0 (pure BE exit): neither win nor loss, streak unchanged.
   GlobalVariableSet(g_gvConsec, (double)g_consecLosses);

   JournalClose(exitTime, exitPrice, totalPL);
   DrawClosedTradeMarker(exitTime, exitPrice, totalPL);
   ObjectsDeleteAll(0, AXN_TRD);           // clear live-trade drawings
   ZeroMemory(g_pos);
   UpdateDashboard();
  }

// Sum of all exit deals (profit+swap+commission) for a position id.
double PositionRealizedPL(const ulong posId)
  {
   if(!HistorySelectByPosition(posId))
      return(0.0);
   double sum = 0.0;
   int deals = HistoryDealsTotal();
   for(int i = 0; i < deals; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0)
         continue;
      ENUM_DEAL_ENTRY de = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY);
      if(de != DEAL_ENTRY_OUT && de != DEAL_ENTRY_OUT_BY)
         continue;
      sum += HistoryDealGetDouble(deal, DEAL_PROFIT)
           + HistoryDealGetDouble(deal, DEAL_SWAP)
           + HistoryDealGetDouble(deal, DEAL_COMMISSION);
     }
   return(sum);
  }

//+------------------------------------------------------------------+
//| PHASE 8 - DASHBOARD                                              |
//+------------------------------------------------------------------+
void CreateDashboardSkeleton(void)
  {
   string bg = AXN_DASH + "BG";
   ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, bg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, 8);
   ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, 20);
   ObjectSetInteger(0, bg, OBJPROP_XSIZE, 320);
   ObjectSetInteger(0, bg, OBJPROP_YSIZE, 150);
   ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, CLR_NAVY);
   ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, bg, OBJPROP_COLOR, CLR_GOLD);
   ObjectSetInteger(0, bg, OBJPROP_BACK, false);
   ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, bg, OBJPROP_HIDDEN, true);

   for(int row = 0; row < 7; row++)
     {
      string name = AXN_DASH + "ROW" + IntegerToString(row);
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 16);
      ObjectSetInteger(0, name, OBJPROP_YDISTANCE, 26 + row * 19);
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, row == 0 ? InpFontSize + 1 : InpFontSize);
      ObjectSetInteger(0, name, OBJPROP_COLOR, row == 0 ? InpColorHeader : InpColorText);
      ObjectSetString(0, name, OBJPROP_FONT, row == 0 ? "Arial Black" : "Arial");
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
     }
   SetDashRow(0, "AXION SYNTHETIC REVERTER v2.0", InpColorHeader);
  }

// Write a row only when its text changed (cheap redraws).
void SetDashRow(const int row, const string text, const color clr)
  {
   if(row < 0 || row > 6)
      return;
   string key = text + "|" + IntegerToString((int)clr);
   if(g_dashCache[row] == key)
      return;
   g_dashCache[row] = key;
   string name = AXN_DASH + "ROW" + IntegerToString(row);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
  }

void UpdateDashboard(void)
  {
   if(!g_visuals || !InpShowDashboard)
      return;

   // Row 1 - status
   string status = "TRADING";
   color  sclr   = clrLimeGreen;
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double ddPct  = (g_hwm > 0.0) ? (g_hwm - equity) / g_hwm * 100.0 : 0.0;
   if(ddPct >= InpMaxDrawdownPct)                 { status = "HALTED-DD";    sclr = clrRed; }
   else if(g_dailyAlerted)                        { status = "HALTED-DAILY"; sclr = clrRed; }
   else if(InCooldown())                          { status = "COOLDOWN";     sclr = clrOrange; }
   SetDashRow(1, "Status: " + status, sclr);

   // Row 2 - winrate | profit factor
   double winrate = (g_statTotal > 0) ? 100.0 * g_statWins / g_statTotal : 0.0;
   double pf      = (g_statGrossLoss > 0.0) ? g_statGrossProfit / g_statGrossLoss : 0.0;
   SetDashRow(2, StringFormat("Winrate: %.1f%%   PF: %.2f   (%d trades)", winrate, pf, g_statTotal), InpColorText);

   // Row 3 - today
   double dayPL = g_dayRealized + FloatingPL();
   SetDashRow(3, StringFormat("Today: %d trades   P/L: %.2f", g_tradesToday, dayPL),
              dayPL >= 0.0 ? clrLimeGreen : clrTomato);

   // Row 4 - drawdown | equity
   SetDashRow(4, StringFormat("DD from HWM: %.2f%%   Equity: %.2f", ddPct, equity), InpColorText);

   // Row 5 - volatility regime
   bool inBand = VolRegimeOK();
   SetDashRow(5, "Vol regime: " + (inBand ? "IN-BAND" : "OUT-OF-BAND"),
              inBand ? clrLimeGreen : clrOrange);

   // Row 6 - last confluence tag
   SetDashRow(6, "Last signal: " + g_lastTag, InpColorHeader);
   ChartRedraw(0);
  }

//+------------------------------------------------------------------+
//| PHASE 9 - VISUAL ENGINE (all AXN_-prefixed, off when disabled)   |
//+------------------------------------------------------------------+

// Helper: horizontal-style trend line from the entry bar rightwards + text label.
void DrawLevel(const string name, const datetime t0, const double price,
               const color clr, const ENUM_LINE_STYLE style, const string label)
  {
   datetime t1 = t0 + PeriodSeconds(_Period) * 40;   // project ~40 bars right
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_TREND, 0, t0, price, t1, price);
   else
     {
      ObjectMove(0, name, 0, t0, price);
      ObjectMove(0, name, 1, t1, price);
     }
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_STYLE, style);
   ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);

   string lbl = name + "_LBL";
   if(ObjectFind(0, lbl) < 0)
      ObjectCreate(0, lbl, OBJ_TEXT, 0, t1, price);
   else
      ObjectMove(0, lbl, 0, t1, price);
   ObjectSetString(0, lbl, OBJPROP_TEXT, label);
   ObjectSetInteger(0, lbl, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, lbl, OBJPROP_FONTSIZE, InpFontSize);
   ObjectSetInteger(0, lbl, OBJPROP_ANCHOR, ANCHOR_LEFT);
   ObjectSetInteger(0, lbl, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, lbl, OBJPROP_HIDDEN, true);
  }

// 9.1/9.2/9.3/9.6/9.7 - full entry snapshot drawn once at execution.
void DrawTradeVisuals(void)
  {
   if(!g_visuals)
      return;
   datetime t0 = iTime(_Symbol, _Period, 0);
   string dir = (g_pos.direction > 0) ? "BUY" : "SELL";

   // 9.1 Entry line (white).
   DrawLevel(AXN_TRD + "ENTRY", t0, g_pos.entry, clrWhite, STYLE_SOLID,
             StringFormat("ENTRY %s @ %s", dir, DoubleToString(g_pos.entry, _Digits)));

   // 9.2 TP lines (gold, solid until filled).
   if(InpTPMode == TP_TIERED)
     {
      DrawLevel(AXN_TRD + "TP1", t0, g_pos.tp1, CLR_GOLD, STYLE_SOLID,
                StringFormat("TP1 @ %s (close %.0f%%)", DoubleToString(g_pos.tp1, _Digits), InpTP1Pct));
      DrawLevel(AXN_TRD + "TP2", t0, g_pos.tp2, CLR_GOLD, STYLE_SOLID,
                StringFormat("TP2 @ %s (close %.0f%%)", DoubleToString(g_pos.tp2, _Digits), InpTP2Pct));
      DrawLevel(AXN_TRD + "TP3", t0, g_pos.tp3, CLR_GOLD, STYLE_SOLID,
                StringFormat("TP3 @ %s (runner)", DoubleToString(g_pos.tp3, _Digits)));
     }
   else
      DrawLevel(AXN_TRD + "TP3", t0, g_pos.tp3, CLR_GOLD, STYLE_SOLID,
                StringFormat("TP @ %s (mean)", DoubleToString(g_pos.tp3, _Digits)));

   // 9.3 SL line (red) with points + money risk.
   double slPts  = MathAbs(g_pos.entry - g_pos.initialSL) / _Point;
   double riskMoney = AccountInfoDouble(ACCOUNT_EQUITY) * InpRiskPercent / 100.0;
   DrawLevel(AXN_TRD + "SL", t0, g_pos.initialSL, clrRed, STYLE_SOLID,
             StringFormat("SL @ %s (-%.0f pts / -$%.2f risk)",
                          DoubleToString(g_pos.initialSL, _Digits), slPts, riskMoney));

   // 9.6 Mean/target zone: shaded band around the reversion anchor so the
   // TP logic is visually explainable.
   double atr = 0.0;
   if(BufferValue(g_hATR, 1, atr) && atr > 0.0)
     {
      string zone = AXN_TRD + "ZONE";
      datetime t1 = t0 + PeriodSeconds(_Period) * 40;
      double zHi = g_pos.tp3 + atr * 0.25;
      double zLo = g_pos.tp3 - atr * 0.25;
      if(ObjectFind(0, zone) < 0)
         ObjectCreate(0, zone, OBJ_RECTANGLE, 0, t0, zHi, t1, zLo);
      ObjectSetInteger(0, zone, OBJPROP_COLOR, CLR_NAVY_SOFT);
      ObjectSetInteger(0, zone, OBJPROP_BGCOLOR, CLR_NAVY_SOFT);
      ObjectSetInteger(0, zone, OBJPROP_FILL, true);
      ObjectSetInteger(0, zone, OBJPROP_BACK, true);
      ObjectSetInteger(0, zone, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, zone, OBJPROP_HIDDEN, true);
     }

   // 9.7 Entry reason tag at the signal bar.
   string tag = AXN_TRD + "TAG";
   double tagPrice = (g_pos.direction > 0) ? iLow(_Symbol, _Period, 1) - atr * 0.3
                                           : iHigh(_Symbol, _Period, 1) + atr * 0.3;
   if(ObjectFind(0, tag) < 0)
      ObjectCreate(0, tag, OBJ_TEXT, 0, iTime(_Symbol, _Period, 1), tagPrice);
   ObjectSetString(0, tag, OBJPROP_TEXT, g_pos.confluenceTag);
   ObjectSetInteger(0, tag, OBJPROP_COLOR, CLR_GOLD);
   ObjectSetInteger(0, tag, OBJPROP_FONTSIZE, InpFontSize - 1);
   ObjectSetInteger(0, tag, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, tag, OBJPROP_HIDDEN, true);
   ChartRedraw(0);
  }

// 9.2 (fill state) - a touched tier turns dotted and gets a FILLED suffix.
void MarkTierFilled(const string tier)
  {
   PrintFormat("AXION %s filled on position #%I64u.", tier, g_pos.ticket);
   if(!g_visuals)
      return;
   string name = AXN_TRD + tier;
   if(ObjectFind(0, name) >= 0)
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT);
   string lbl = name + "_LBL";
   if(ObjectFind(0, lbl) >= 0)
     {
      string txt = "";
      txt = ObjectGetString(0, lbl, OBJPROP_TEXT);
      if(StringFind(txt, "FILLED") < 0)
         ObjectSetString(0, lbl, OBJPROP_TEXT, txt + "  [FILLED]");
     }
   ChartRedraw(0);
  }

// 9.4 - break-even: SL line goes aqua + risk-free label + activation arrow.
void DrawBreakEvenVisuals(const double bePrice)
  {
   if(!g_visuals)
      return;
   DrawLevel(AXN_TRD + "SL", iTime(_Symbol, _Period, 0), bePrice, clrAqua, STYLE_SOLID,
             StringFormat("BE @ %s (risk-free)", DoubleToString(bePrice, _Digits)));
   string arrow = AXN_TRD + "BEARROW";
   if(ObjectFind(0, arrow) < 0)
      ObjectCreate(0, arrow, OBJ_ARROW, 0, iTime(_Symbol, _Period, 0), bePrice);
   ObjectSetInteger(0, arrow, OBJPROP_ARROWCODE, 108);   // small circle
   ObjectSetInteger(0, arrow, OBJPROP_COLOR, clrAqua);
   ObjectSetInteger(0, arrow, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, arrow, OBJPROP_HIDDEN, true);
   ChartRedraw(0);
  }

// 9.5 - trailing: dashed orange SL + faint dotted ghost markers of prior levels.
void DrawTrailVisuals(const double oldLevel, const double newLevel)
  {
   if(!g_visuals)
      return;
   DrawLevel(AXN_TRD + "SL", iTime(_Symbol, _Period, 0), newLevel, clrOrange, STYLE_DASH,
             StringFormat("TRAIL @ %s", DoubleToString(newLevel, _Digits)));
   // Ghost marker of the level being abandoned (capped to avoid object spam).
   if(g_pos.ghostCount < 50)
     {
      string ghost = AXN_TRD + "GHOST" + IntegerToString(g_pos.ghostCount++);
      if(ObjectCreate(0, ghost, OBJ_ARROW, 0, iTime(_Symbol, _Period, 0), oldLevel))
        {
         ObjectSetInteger(0, ghost, OBJPROP_ARROWCODE, 159);   // dot
         ObjectSetInteger(0, ghost, OBJPROP_COLOR, C'120,90,40'); // faint dark orange
         ObjectSetInteger(0, ghost, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, ghost, OBJPROP_HIDDEN, true);
        }
     }
   ChartRedraw(0);
  }

// 9.8 - closed-trade markers: ring buffer of the last N results.
void DrawClosedTradeMarker(const datetime exitTime, const double exitPrice, const double pl)
  {
   if(!g_visuals || InpTradeHistoryDepth <= 0)
      return;
   int slot = g_histIdx % InpTradeHistoryDepth;
   g_histIdx++;

   string arrow = AXN_HIST + "A" + IntegerToString(slot);
   string text  = AXN_HIST + "T" + IntegerToString(slot);
   ObjectDelete(0, arrow);                 // overwrite the oldest slot
   ObjectDelete(0, text);

   bool win = (pl >= 0.0);
   if(ObjectCreate(0, arrow, OBJ_ARROW, 0, exitTime, exitPrice))
     {
      ObjectSetInteger(0, arrow, OBJPROP_ARROWCODE, win ? 252 : 251); // Wingdings check / cross
      ObjectSetInteger(0, arrow, OBJPROP_COLOR, win ? clrLimeGreen : clrRed);
      ObjectSetInteger(0, arrow, OBJPROP_WIDTH, 2);
      ObjectSetInteger(0, arrow, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, arrow, OBJPROP_HIDDEN, true);
     }
   if(ObjectCreate(0, text, OBJ_TEXT, 0, exitTime, exitPrice))
     {
      ObjectSetString(0, text, OBJPROP_TEXT, StringFormat("%+.2f", pl));
      ObjectSetInteger(0, text, OBJPROP_COLOR, win ? clrLimeGreen : clrRed);
      ObjectSetInteger(0, text, OBJPROP_FONTSIZE, InpFontSize - 1);
      ObjectSetInteger(0, text, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER);
      ObjectSetInteger(0, text, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, text, OBJPROP_HIDDEN, true);
     }
   ChartRedraw(0);
  }

//+------------------------------------------------------------------+
//| PHASE 10 - JOURNAL (CSV in MQL5\Files)                           |
//+------------------------------------------------------------------+
// Appends one line; opens FILE_CSV|READ|WRITE|SHARE_READ, seeks to end,
// always closes after the write.
void JournalWriteRow(const string openTime, const string dir, const string entry,
                     const string sl, const string tp, const string lots,
                     const string tag, const string exitTime, const string exitPrice,
                     const string pl, const string result, const string be, const string trail)
  {
   int fh = FileOpen(InpJournalFileName, FILE_CSV | FILE_READ | FILE_WRITE | FILE_SHARE_READ | FILE_ANSI, ',');
   if(fh == INVALID_HANDLE)
     {
      Print("AXION: journal open failed, error ", GetLastError());
      return;
     }
   FileSeek(fh, 0, SEEK_END);
   FileWrite(fh, openTime, _Symbol, dir, entry, sl, tp, lots, tag,
             exitTime, exitPrice, pl, result, be, trail);
   FileClose(fh);
  }

// Open half: an OPEN stub row is written immediately so the file is a
// complete audit trail even across a crash; the close writes the full row.
void JournalOpen(void)
  {
   if(!InpEnableJournal)
      return;
   g_journalPending = true;
   JournalWriteRow(TimeToString(g_pos.openTime, TIME_DATE | TIME_SECONDS),
                   g_pos.direction > 0 ? "BUY" : "SELL",
                   DoubleToString(g_pos.entry, _Digits),
                   DoubleToString(g_pos.initialSL, _Digits),
                   DoubleToString(g_pos.tp3, _Digits),
                   DoubleToString(g_pos.initialLots, 2),
                   g_pos.confluenceTag,
                   "", "", "", "OPEN", "", "");
  }

void JournalClose(const datetime exitTime, const double exitPrice, const double pl)
  {
   if(!InpEnableJournal)
      return;
   g_journalPending = false;
   JournalWriteRow(TimeToString(g_pos.openTime, TIME_DATE | TIME_SECONDS),
                   g_pos.direction > 0 ? "BUY" : "SELL",
                   DoubleToString(g_pos.entry, _Digits),
                   DoubleToString(g_pos.initialSL, _Digits),
                   DoubleToString(g_pos.tp3, _Digits),
                   DoubleToString(g_pos.initialLots, 2),
                   g_pos.confluenceTag,
                   TimeToString(exitTime, TIME_DATE | TIME_SECONDS),
                   DoubleToString(exitPrice, _Digits),
                   DoubleToString(pl, 2),
                   pl > 0.0 ? "WIN" : (pl < 0.0 ? "LOSS" : "BE"),
                   g_pos.beDone ? "YES" : "NO",
                   g_pos.trailOn ? "YES" : "NO");
  }

//+------------------------------------------------------------------+
//| PHASE 11 - OnDeinit                                              |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   // 1. Never orphan chart objects.
   ObjectsDeleteAll(0, AXN_PREFIX);
   ChartRedraw(0);

   // 2. Release indicator handles.
   if(g_hATR    != INVALID_HANDLE) IndicatorRelease(g_hATR);
   if(g_hMean   != INVALID_HANDLE) IndicatorRelease(g_hMean);
   if(g_hStdDev != INVALID_HANDLE) IndicatorRelease(g_hStdDev);

   // 3. Persist state.
   GlobalVariableSet(g_gvHWM, g_hwm);
   GlobalVariableSet(g_gvCooldown, (double)(long)g_cooldownUntil);
   GlobalVariableSet(g_gvConsec, (double)g_consecLosses);

   // 4. Session summary.
   double winrate = (g_statTotal > 0) ? 100.0 * g_statWins / g_statTotal : 0.0;
   double pf      = (g_statGrossLoss > 0.0) ? g_statGrossProfit / g_statGrossLoss : 0.0;
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   double ddPct   = (g_hwm > 0.0) ? (g_hwm - equity) / g_hwm * 100.0 : 0.0;
   PrintFormat("AXION session summary: trades=%d winrate=%.1f%% PF=%.2f DD-from-HWM=%.2f%% (reason %d)",
               g_statTotal, winrate, pf, ddPct, reason);
  }
//+------------------------------------------------------------------+
