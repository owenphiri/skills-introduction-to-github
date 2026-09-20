//+------------------------------------------------------------------+
//|                                                  SwingEngine.mqh |
//| Swing point / fractal detection and HH-HL-LH-LL labelling.       |
//|                                                                  |
//| A swing high of strength N is a bar whose high exceeds the highs |
//| of the N bars on each side (classic fractal generalisation).     |
//| Detection is strictly non-repainting: a swing is only confirmed  |
//| once N fully closed bars exist to its right.                     |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>

class CSwingEngine
  {
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_tf;
   int               m_strength;         // bars each side
   int               m_lookback;         // scan depth in bars
   ApexSwing         m_swings[];         // chronological, oldest first
   datetime          m_last_scanned;     // last confirmed bar processed

   void              PushSwing(const ApexSwing &sw)
     {
      int n = ArraySize(m_swings);
      if(n >= APEX_MAX_SWINGS)
        {
         // drop oldest half to bound memory
         int keep = APEX_MAX_SWINGS / 2;
         for(int i = 0; i < keep; i++)
            m_swings[i] = m_swings[n - keep + i];
         ArrayResize(m_swings, keep);
         n = keep;
        }
      ArrayResize(m_swings, n + 1);
      m_swings[n] = sw;
     }

   //--- label a new swing relative to the previous swing of same type
   ENUM_APEX_SWING_LABEL LabelSwing(const ApexSwing &sw) const
     {
      for(int i = ArraySize(m_swings) - 1; i >= 0; i--)
        {
         if(m_swings[i].type != sw.type) continue;
         if(sw.type == SWING_HIGH)
            return (sw.price > m_swings[i].price) ? LABEL_HH : LABEL_LH;
         return (sw.price > m_swings[i].price) ? LABEL_HL : LABEL_LL;
        }
      return LABEL_NONE;
     }

public:
                     CSwingEngine() : m_symbol(""), m_tf(PERIOD_CURRENT), m_strength(3),
                                      m_lookback(500), m_last_scanned(0) {}

   void              Init(const string symbol, const ENUM_TIMEFRAMES tf,
                          const int strength, const int lookback)
     {
      m_symbol   = symbol;
      m_tf       = tf;
      m_strength = MathMax(1, strength);
      m_lookback = MathMax(50, lookback);
      ArrayResize(m_swings, 0);
      m_last_scanned = 0;
     }

   //--- incremental update; call once per new bar of m_tf
   void              Update()
     {
      int total = iBars(m_symbol, m_tf);
      if(total < m_strength * 2 + 2) return;

      // candidate bars: index m_strength+1 .. lookback (as-series),
      // only those newer than the last processed confirmation time.
      int deepest = MathMin(m_lookback, total - m_strength - 1);
      for(int i = deepest; i >= m_strength + 1; i--)
        {
         datetime bt = iTime(m_symbol, m_tf, i);
         if(bt <= m_last_scanned) continue;

         double hi = iHigh(m_symbol, m_tf, i);
         double lo = iLow(m_symbol, m_tf, i);
         bool is_high = true, is_low = true;
         for(int k = 1; k <= m_strength && (is_high || is_low); k++)
           {
            if(iHigh(m_symbol, m_tf, i - k) >= hi || iHigh(m_symbol, m_tf, i + k) > hi)
               is_high = false;
            if(iLow(m_symbol, m_tf, i - k) <= lo || iLow(m_symbol, m_tf, i + k) < lo)
               is_low = false;
           }

         if(is_high)
           {
            ApexSwing sw;
            sw.time = bt;  sw.price = hi;  sw.bar_index = i;
            sw.type = SWING_HIGH;  sw.swept = false;
            sw.label = LabelSwing(sw);
            PushSwing(sw);
           }
         if(is_low)
           {
            ApexSwing sw;
            sw.time = bt;  sw.price = lo;  sw.bar_index = i;
            sw.type = SWING_LOW;  sw.swept = false;
            sw.label = LabelSwing(sw);
            PushSwing(sw);
           }
        }
      // everything up to the newest *confirmable* bar has been processed
      m_last_scanned = iTime(m_symbol, m_tf, m_strength + 1);
     }

   int               Count() const { return ArraySize(m_swings); }
   bool              Get(const int idx, ApexSwing &out) const
     {
      if(idx < 0 || idx >= ArraySize(m_swings)) return false;
      out = m_swings[idx];
      return true;
     }

   //--- most recent swing of a type; nth=0 latest, nth=1 previous, ...
   bool              Last(const ENUM_APEX_SWING_TYPE type, ApexSwing &out, const int nth = 0) const
     {
      int found = 0;
      for(int i = ArraySize(m_swings) - 1; i >= 0; i--)
         if(m_swings[i].type == type)
           {
            if(found == nth) { out = m_swings[i]; return true; }
            found++;
           }
      return false;
     }

   void              MarkSwept(const datetime swing_time)
     {
      for(int i = ArraySize(m_swings) - 1; i >= 0; i--)
         if(m_swings[i].time == swing_time) { m_swings[i].swept = true; return; }
     }

   //--- unswept swings = resting liquidity pools
   int               UnsweptAbove(const double price, ApexSwing &out)
     {
      int cnt = 0;
      double best = DBL_MAX;
      for(int i = ArraySize(m_swings) - 1; i >= 0; i--)
         if(m_swings[i].type == SWING_HIGH && !m_swings[i].swept && m_swings[i].price > price)
           {
            cnt++;
            if(m_swings[i].price < best) { best = m_swings[i].price; out = m_swings[i]; }
           }
      return cnt;
     }

   int               UnsweptBelow(const double price, ApexSwing &out)
     {
      int cnt = 0;
      double best = -DBL_MAX;
      for(int i = ArraySize(m_swings) - 1; i >= 0; i--)
         if(m_swings[i].type == SWING_LOW && !m_swings[i].swept && m_swings[i].price < price)
           {
            cnt++;
            if(m_swings[i].price > best) { best = m_swings[i].price; out = m_swings[i]; }
           }
      return cnt;
     }
  };
//+------------------------------------------------------------------+
