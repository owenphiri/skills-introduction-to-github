//+------------------------------------------------------------------+
//|                                                 SignalEngine.mqh |
//| Strategy layer: converts price-action context into trade signals.|
//|                                                                  |
//| Strategies (regime-gated):                                       |
//|  A. Trend Pullback   - HTF bias + pullback into demand/supply or |
//|                        S/R confluence + candle confirmation.     |
//|  B. Liquidity Sweep  - stop-hunt through a swing at a key level, |
//|                        rejection close, trade the reversal.      |
//|  C. Breakout Retest  - BOS, then retest of the broken level      |
//|                        that holds, trade continuation.           |
//|  D. False Breakout   - failed break of a range extreme, fade it. |
//|  E. Compression Break- inside-bar/low-vol coil, trade the        |
//|                        expansion with structure alignment.       |
//|                                                                  |
//| Every candidate is scored on confluence [0..1]; only signals     |
//| above the configured threshold are emitted. Quality > quantity.  |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Core/SymbolAdapter.mqh>
#include <ApexPA/PriceAction/SwingEngine.mqh>
#include <ApexPA/PriceAction/StructureEngine.mqh>
#include <ApexPA/PriceAction/CandleEngine.mqh>
#include <ApexPA/PriceAction/LevelEngine.mqh>
#include <ApexPA/PriceAction/ZoneEngine.mqh>
#include <ApexPA/PriceAction/LiquidityEngine.mqh>
#include <ApexPA/PriceAction/RegimeEngine.mqh>
#include <ApexPA/Analysis/MTFAnalyzer.mqh>

struct ApexStrategyConfig
  {
   bool              enable_trend_pullback;
   bool              enable_liquidity_sweep;
   bool              enable_breakout_retest;
   bool              enable_false_breakout;
   bool              enable_compression_break;
   double            min_confluence;      // emit threshold, e.g. 0.60
   double            min_rr;              // minimum reward:risk, e.g. 1.5
   double            sl_buffer_vol;       // SL buffer in volatility units
   double            max_sl_vol;          // reject if SL wider than N vol units
   double            htf_min_conviction;  // MTF bias threshold
  };

class CSignalEngine
  {
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_tf;                // execution timeframe
   ApexStrategyConfig m_cfg;
   CSymbolAdapter   *m_adapter;
   CSwingEngine     *m_swings;
   CStructureEngine *m_structure;
   CCandleEngine    *m_candles;
   CLevelEngine     *m_levels;
   CZoneEngine      *m_zones;
   CLiquidityEngine *m_liquidity;
   CRegimeEngine    *m_regime;
   CMTFAnalyzer     *m_mtf;

   //--- compute SL/TP for a direction given a protective price
   bool              BuildStops(const ENUM_APEX_DIRECTION dir, const double protect_price,
                                double &sl, double &tp, double &rr)
     {
      MqlTick tick;
      if(!SymbolInfoTick(m_symbol, tick)) return false;
      double entry = (dir == DIR_LONG) ? tick.ask : tick.bid;
      double vol   = m_adapter.VolatilityUnit();
      if(vol <= 0) return false;

      sl = (dir == DIR_LONG) ? protect_price - vol * m_cfg.sl_buffer_vol
                             : protect_price + vol * m_cfg.sl_buffer_vol;
      double risk = MathAbs(entry - sl);
      if(risk <= 0 || risk > vol * m_cfg.max_sl_vol) return false;

      // TP at next opposing level if it gives >= min_rr, else fixed 2R
      double lvl;
      tp = 0;
      if(dir == DIR_LONG && m_levels.NextLevelAbove(entry + risk * m_cfg.min_rr, lvl))
         tp = lvl;
      else if(dir == DIR_SHORT && m_levels.NextLevelBelow(entry - risk * m_cfg.min_rr, lvl))
         tp = lvl;
      if(tp <= 0)
         tp = (dir == DIR_LONG) ? entry + risk * 2.0 : entry - risk * 2.0;

      rr = MathAbs(tp - entry) / risk;
      return rr >= m_cfg.min_rr;
     }

   //--- Strategy A: trend pullback
   bool              TrendPullback(ApexSignal &sig)
     {
      if(!m_cfg.enable_trend_pullback) return false;
      if(!m_regime.AllowsStrategy(STRAT_TREND_PULLBACK)) return false;

      ENUM_APEX_DIRECTION bias = m_mtf.BiasDirection(m_cfg.htf_min_conviction);
      if(bias == DIR_NONE) return false;

      // execution TF must be in pullback phase aligned with bias
      ENUM_APEX_TREND t = m_structure.Trend();
      bool pullback_ok = (bias == DIR_LONG  && (t == TREND_BULL_PULLBACK || t == TREND_BULLISH)) ||
                         (bias == DIR_SHORT && (t == TREND_BEAR_PULLBACK || t == TREND_BEARISH));
      if(!pullback_ok) return false;

      // premium/discount: buy discount, sell premium
      double rp = m_structure.RangePosition();
      if(bias == DIR_LONG  && rp > 0.5) return false;
      if(bias == DIR_SHORT && rp < 0.5) return false;

      double px = iClose(m_symbol, m_tf, 1);
      double score = 0.30;   // base: HTF alignment + pullback location
      string why = "HTF bias " + m_mtf.BiasText() + "; pullback";

      // confluence: inside a demand/supply zone?
      ApexZone zone;
      double zs = m_zones.InZone(px, bias, zone);
      if(zs > 0) { score += zs * 0.30; why += "; zone(" + DoubleToString(zs, 2) + ")"; }

      // confluence: at a horizontal level?
      ApexLevel lvl;
      double tol = m_adapter.VolatilityUnit() * 0.5;
      double ls = m_levels.NearestLevel(px, tol, lvl);
      if(ls > 0) { score += ls * 0.20; why += "; level(" + DoubleToString(ls, 2) + ")"; }

      // trigger: candle confirmation in bias direction
      string pattern;
      double cs = m_candles.Confirmation(bias, pattern);
      if(cs <= 0) return false;
      score += cs * 0.25;
      why += "; " + pattern;

      if(score < m_cfg.min_confluence) return false;

      // protective swing
      ApexSwing sw;
      double protect = (bias == DIR_LONG)
                       ? (m_swings.Last(SWING_LOW, sw)  ? sw.price : iLow(m_symbol, m_tf, 1))
                       : (m_swings.Last(SWING_HIGH, sw) ? sw.price : iHigh(m_symbol, m_tf, 1));

      double sl, tp, rr;
      if(!BuildStops(bias, protect, sl, tp, rr)) return false;

      sig.valid      = true;
      sig.strategy   = STRAT_TREND_PULLBACK;
      sig.direction  = bias;
      sig.entry      = 0;
      sig.stop_loss  = sl;
      sig.take_profit= tp;
      sig.confidence = MathMin(1.0, score);
      sig.reason     = why + StringFormat("; RR=%.1f", rr);
      sig.bar_time   = iTime(m_symbol, m_tf, 0);
      return true;
     }

   //--- Strategy B: liquidity sweep reversal
   bool              LiquiditySweep(ApexSignal &sig)
     {
      if(!m_cfg.enable_liquidity_sweep) return false;
      if(!m_regime.AllowsStrategy(STRAT_LIQUIDITY_SWEEP)) return false;

      ApexSweepEvent sweep;
      if(!m_liquidity.RecentSweep(sweep, 3)) return false;

      double score = 0.25 + sweep.quality * 0.35;
      string why = StringFormat("Sweep of %.5f (q=%.2f)", sweep.swept_level, sweep.quality);

      // stronger if the sweep happened at a significant level
      ApexLevel lvl;
      double tol = m_adapter.VolatilityUnit() * 0.6;
      double ls = m_levels.NearestLevel(sweep.swept_level, tol, lvl);
      if(ls > 0) { score += ls * 0.20; why += "; at key level"; }

      // counter-trend sweeps need HTF agreement or extra quality
      ENUM_APEX_DIRECTION bias = m_mtf.BiasDirection(m_cfg.htf_min_conviction);
      if(bias != DIR_NONE && bias == sweep.reversal_dir)
        { score += 0.10; why += "; with HTF bias"; }
      else if(bias != DIR_NONE && bias != sweep.reversal_dir && sweep.quality < 0.75)
         return false;

      // trigger: confirmation candle in reversal direction
      string pattern;
      double cs = m_candles.Confirmation(sweep.reversal_dir, pattern);
      if(cs <= 0) return false;
      score += cs * 0.15;
      why += "; " + pattern;

      if(score < m_cfg.min_confluence) return false;

      double protect = (sweep.reversal_dir == DIR_LONG)
                       ? MathMin(iLow(m_symbol, m_tf, 1), iLow(m_symbol, m_tf, 2))
                       : MathMax(iHigh(m_symbol, m_tf, 1), iHigh(m_symbol, m_tf, 2));

      double sl, tp, rr;
      if(!BuildStops(sweep.reversal_dir, protect, sl, tp, rr)) return false;

      sig.valid      = true;
      sig.strategy   = STRAT_LIQUIDITY_SWEEP;
      sig.direction  = sweep.reversal_dir;
      sig.entry      = 0;
      sig.stop_loss  = sl;
      sig.take_profit= tp;
      sig.confidence = MathMin(1.0, score);
      sig.reason     = why + StringFormat("; RR=%.1f", rr);
      sig.bar_time   = iTime(m_symbol, m_tf, 0);
      return true;
     }

   //--- Strategy C: breakout + retest continuation
   bool              BreakoutRetest(ApexSignal &sig)
     {
      if(!m_cfg.enable_breakout_retest) return false;
      if(!m_regime.AllowsStrategy(STRAT_BREAKOUT_RETEST)) return false;

      ENUM_APEX_STRUCTURE_EVENT ev = m_structure.LastEvent();
      if(ev != STRUCT_BOS_BULL && ev != STRUCT_BOS_BEAR) return false;

      // event must be recent (within ~10 execution bars)
      datetime cutoff = iTime(m_symbol, m_tf, MathMin(10, iBars(m_symbol, m_tf) - 1));
      if(m_structure.LastEventTime() < cutoff) return false;

      ENUM_APEX_DIRECTION dir = (ev == STRUCT_BOS_BULL) ? DIR_LONG : DIR_SHORT;
      ENUM_APEX_DIRECTION bias = m_mtf.BiasDirection(m_cfg.htf_min_conviction);
      if(bias != DIR_NONE && bias != dir) return false;   // never fight HTF

      double level = m_structure.LastEventLevel();
      double tol = m_adapter.VolatilityUnit() * 0.35;
      if(!m_liquidity.BreakoutRetest(level, dir, tol)) return false;

      double score = 0.45;
      string why = StringFormat("BOS %s @ %.5f + retest hold", dir == DIR_LONG ? "up" : "down", level);
      if(bias == dir) { score += 0.15; why += "; with HTF bias"; }

      string pattern;
      double cs = m_candles.Confirmation(dir, pattern);
      if(cs > 0) { score += cs * 0.20; why += "; " + pattern; }
      else score -= 0.05;

      if(score < m_cfg.min_confluence) return false;

      double protect = (dir == DIR_LONG) ? level - tol : level + tol;
      double sl, tp, rr;
      if(!BuildStops(dir, protect, sl, tp, rr)) return false;

      sig.valid      = true;
      sig.strategy   = STRAT_BREAKOUT_RETEST;
      sig.direction  = dir;
      sig.entry      = 0;
      sig.stop_loss  = sl;
      sig.take_profit= tp;
      sig.confidence = MathMin(1.0, score);
      sig.reason     = why + StringFormat("; RR=%.1f", rr);
      sig.bar_time   = iTime(m_symbol, m_tf, 0);
      return true;
     }

   //--- Strategy D: false breakout fade (range regime)
   bool              FalseBreakoutFade(ApexSignal &sig)
     {
      if(!m_cfg.enable_false_breakout) return false;
      if(!m_regime.AllowsStrategy(STRAT_FALSE_BREAKOUT)) return false;

      // fade failures at period extremes and strong S/R
      double px = iClose(m_symbol, m_tf, 1);
      double tol = m_adapter.VolatilityUnit() * 1.5;

      for(int i = 0; i < m_levels.Count(); i++)
        {
         ApexLevel lvl;
         if(!m_levels.Get(i, lvl)) continue;
         if(lvl.strength < 0.55) continue;               // only strong levels
         if(MathAbs(lvl.price - px) > tol) continue;

         ENUM_APEX_DIRECTION fade;
         if(!m_liquidity.FalseBreakout(lvl.price, fade, 4)) continue;

         string pattern;
         double cs = m_candles.Confirmation(fade, pattern);
         if(cs <= 0) continue;

         double score = 0.35 + lvl.strength * 0.25 + cs * 0.20;
         if(score < m_cfg.min_confluence) continue;

         double protect = (fade == DIR_LONG)
                          ? MathMin(iLow(m_symbol, m_tf, 1), iLow(m_symbol, m_tf, 2))
                          : MathMax(iHigh(m_symbol, m_tf, 1), iHigh(m_symbol, m_tf, 2));
         double sl, tp, rr;
         if(!BuildStops(fade, protect, sl, tp, rr)) continue;

         sig.valid      = true;
         sig.strategy   = STRAT_FALSE_BREAKOUT;
         sig.direction  = fade;
         sig.entry      = 0;
         sig.stop_loss  = sl;
         sig.take_profit= tp;
         sig.confidence = MathMin(1.0, score);
         sig.reason     = StringFormat("False break of %.5f; %s; RR=%.1f", lvl.price, pattern, rr);
         sig.bar_time   = iTime(m_symbol, m_tf, 0);
         return true;
        }
      return false;
     }

   //--- Strategy E: compression breakout
   bool              CompressionBreak(ApexSignal &sig)
     {
      if(!m_cfg.enable_compression_break) return false;
      if(!m_regime.AllowsStrategy(STRAT_COMPRESSION_BREAK)) return false;

      // need a coil: >=2 of the last 4 closed bars are inside bars
      int inside = 0;
      for(int i = 1; i <= 4; i++)
         if(m_candles.InsideBar(i)) inside++;
      if(inside < 2) return false;

      // breakout bar: last closed bar leaves the coil range decisively
      double coil_hi = -DBL_MAX, coil_lo = DBL_MAX;
      for(int i = 2; i <= 6; i++)
        {
         coil_hi = MathMax(coil_hi, iHigh(m_symbol, m_tf, i));
         coil_lo = MathMin(coil_lo, iLow(m_symbol, m_tf, i));
        }
      double c1 = iClose(m_symbol, m_tf, 1);
      ENUM_APEX_DIRECTION dir = DIR_NONE;
      if(c1 > coil_hi) dir = DIR_LONG;
      if(c1 < coil_lo) dir = DIR_SHORT;
      if(dir == DIR_NONE) return false;

      // structure alignment: don't break against a clear HTF trend
      ENUM_APEX_DIRECTION bias = m_mtf.BiasDirection(m_cfg.htf_min_conviction);
      if(bias != DIR_NONE && bias != dir) return false;

      double score = 0.45 + inside * 0.05;
      if(bias == dir) score += 0.15;
      if(score < m_cfg.min_confluence) return false;

      double protect = (dir == DIR_LONG) ? coil_lo : coil_hi;
      double sl, tp, rr;
      if(!BuildStops(dir, protect, sl, tp, rr)) return false;

      sig.valid      = true;
      sig.strategy   = STRAT_COMPRESSION_BREAK;
      sig.direction  = dir;
      sig.entry      = 0;
      sig.stop_loss  = sl;
      sig.take_profit= tp;
      sig.confidence = MathMin(1.0, score);
      sig.reason     = StringFormat("Compression break (%d inside bars); RR=%.1f", inside, rr);
      sig.bar_time   = iTime(m_symbol, m_tf, 0);
      return true;
     }

public:
                     CSignalEngine() : m_symbol(""), m_tf(PERIOD_CURRENT) {}

   void              Init(const string symbol, const ENUM_TIMEFRAMES tf,
                          const ApexStrategyConfig &cfg,
                          CSymbolAdapter *adapter, CSwingEngine *swings,
                          CStructureEngine *structure, CCandleEngine *candles,
                          CLevelEngine *levels, CZoneEngine *zones,
                          CLiquidityEngine *liquidity, CRegimeEngine *regime,
                          CMTFAnalyzer *mtf)
     {
      m_symbol    = symbol;
      m_tf        = tf;
      m_cfg       = cfg;
      m_adapter   = adapter;
      m_swings    = swings;
      m_structure = structure;
      m_candles   = candles;
      m_levels    = levels;
      m_zones     = zones;
      m_liquidity = liquidity;
      m_regime    = regime;
      m_mtf       = mtf;
     }

   //--- evaluate all strategies; returns the highest-confidence signal
   bool              Evaluate(ApexSignal &best)
     {
      best.valid = false;
      best.confidence = 0;

      ApexSignal cand;
      cand.valid = false;

      if(TrendPullback(cand)   && cand.confidence > best.confidence) best = cand;
      cand.valid = false;
      if(LiquiditySweep(cand)  && cand.confidence > best.confidence) best = cand;
      cand.valid = false;
      if(BreakoutRetest(cand)  && cand.confidence > best.confidence) best = cand;
      cand.valid = false;
      if(FalseBreakoutFade(cand) && cand.confidence > best.confidence) best = cand;
      cand.valid = false;
      if(CompressionBreak(cand) && cand.confidence > best.confidence) best = cand;

      return best.valid;
     }
  };
//+------------------------------------------------------------------+
