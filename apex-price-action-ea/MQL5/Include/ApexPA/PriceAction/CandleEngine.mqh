//+------------------------------------------------------------------+
//|                                                 CandleEngine.mqh |
//| Single/multi-candle price action pattern recognition.            |
//|                                                                  |
//| Detects on CLOSED bars only:                                     |
//|  - pin bars (rejection wicks) with quality scoring               |
//|  - engulfing candles (body engulfment, not just range)           |
//|  - inside bars / outside bars                                    |
//| Every detector returns a score in [0,1] so the signal engine can |
//| weight confirmation quality instead of treating patterns as      |
//| binary events.                                                   |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>

class CCandleEngine
  {
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_tf;
   double            m_min_body_atr;     // minimum body size vs vol unit to matter

   void              Bar(const int shift, double &o, double &h, double &l, double &c) const
     {
      o = iOpen(m_symbol, m_tf, shift);
      h = iHigh(m_symbol, m_tf, shift);
      l = iLow(m_symbol, m_tf, shift);
      c = iClose(m_symbol, m_tf, shift);
     }

public:
                     CCandleEngine() : m_symbol(""), m_tf(PERIOD_CURRENT), m_min_body_atr(0.10) {}

   void              Init(const string symbol, const ENUM_TIMEFRAMES tf)
     {
      m_symbol = symbol;
      m_tf     = tf;
     }

   //--- Pin bar: long rejection wick, small body at the opposite end.
   //--- Returns score 0..1 (0 = not a pin). shift=1 -> last closed bar.
   double            PinBar(const int shift, ENUM_APEX_DIRECTION &dir) const
     {
      double o, h, l, c;
      Bar(shift, o, h, l, c);
      double range = h - l;
      dir = DIR_NONE;
      if(range <= 0) return 0;

      double body      = MathAbs(c - o);
      double upper_wick = h - MathMax(o, c);
      double lower_wick = MathMin(o, c) - l;

      // bullish pin: lower wick dominates
      if(lower_wick >= range * 0.55 && body <= range * 0.30 && upper_wick <= range * 0.25)
        {
         dir = DIR_LONG;
         double sc = (lower_wick / range - 0.55) / 0.45;      // wick dominance
         if(c > o) sc += 0.15;                                 // bullish close bonus
         return MathMin(1.0, 0.5 + sc);
        }
      // bearish pin: upper wick dominates
      if(upper_wick >= range * 0.55 && body <= range * 0.30 && lower_wick <= range * 0.25)
        {
         dir = DIR_SHORT;
         double sc = (upper_wick / range - 0.55) / 0.45;
         if(c < o) sc += 0.15;
         return MathMin(1.0, 0.5 + sc);
        }
      return 0;
     }

   //--- Engulfing: current body fully engulfs previous body and closes
   //--- beyond the previous extreme in the pattern direction.
   double            Engulfing(const int shift, ENUM_APEX_DIRECTION &dir) const
     {
      double o1, h1, l1, c1, o2, h2, l2, c2;
      Bar(shift, o1, h1, l1, c1);        // engulfing bar
      Bar(shift + 1, o2, h2, l2, c2);    // engulfed bar
      dir = DIR_NONE;

      double body1 = MathAbs(c1 - o1);
      double body2 = MathAbs(c2 - o2);
      if(body1 <= 0 || body2 <= 0) return 0;

      bool bull = (c1 > o1) && (c2 < o2) && (c1 >= MathMax(o2, c2)) && (o1 <= MathMin(o2, c2));
      bool bear = (c1 < o1) && (c2 > o2) && (c1 <= MathMin(o2, c2)) && (o1 >= MathMax(o2, c2));
      if(!bull && !bear) return 0;

      dir = bull ? DIR_LONG : DIR_SHORT;
      double dominance = MathMin(1.0, body1 / (body2 * 2.0));  // 2x body = max score
      double close_quality = bull ? (c1 > h2 ? 0.25 : 0.0) : (c1 < l2 ? 0.25 : 0.0);
      return MathMin(1.0, 0.5 + dominance * 0.25 + close_quality);
     }

   //--- Inside bar: full range inside the mother bar (compression signal)
   bool              InsideBar(const int shift) const
     {
      double o1, h1, l1, c1, o2, h2, l2, c2;
      Bar(shift, o1, h1, l1, c1);
      Bar(shift + 1, o2, h2, l2, c2);
      return (h1 < h2 && l1 > l2);
     }

   //--- Outside bar: engulfs the previous range entirely
   bool              OutsideBar(const int shift, ENUM_APEX_DIRECTION &dir) const
     {
      double o1, h1, l1, c1, o2, h2, l2, c2;
      Bar(shift, o1, h1, l1, c1);
      Bar(shift + 1, o2, h2, l2, c2);
      dir = DIR_NONE;
      if(h1 > h2 && l1 < l2)
        {
         dir = (c1 > o1) ? DIR_LONG : DIR_SHORT;
         return true;
        }
      return false;
     }

   //--- Best directional confirmation on the last closed bar.
   //--- Used by the signal engine as the trigger filter.
   double            Confirmation(ENUM_APEX_DIRECTION want, string &pattern) const
     {
      ENUM_APEX_DIRECTION d;
      double s;
      pattern = "";

      s = Engulfing(1, d);
      if(s > 0 && d == want) { pattern = "Engulfing"; return s; }

      s = PinBar(1, d);
      if(s > 0 && d == want) { pattern = "Pin Bar"; return s; }

      if(OutsideBar(1, d) && d == want) { pattern = "Outside Bar"; return 0.55; }

      // momentum close: strong directional body closing near the extreme
      double o, h, l, c;
      Bar(1, o, h, l, c);
      double range = h - l;
      if(range > 0)
        {
         double body = MathAbs(c - o);
         if(want == DIR_LONG && c > o && body >= range * 0.65 && (h - c) <= range * 0.20)
           { pattern = "Momentum Close"; return 0.50; }
         if(want == DIR_SHORT && c < o && body >= range * 0.65 && (c - l) <= range * 0.20)
           { pattern = "Momentum Close"; return 0.50; }
        }
      return 0;
     }
  };
//+------------------------------------------------------------------+
