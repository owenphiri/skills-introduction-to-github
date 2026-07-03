//+------------------------------------------------------------------+
//|                                              LiquidityEngine.mqh |
//| Liquidity pools, sweeps, false breakouts and breakout-retest.    |
//|                                                                  |
//| Sweep       : wick trades beyond a resting swing (stop cluster)  |
//|               but the bar CLOSES back inside -> stop hunt.       |
//| False break : close beyond a level followed by a close back      |
//|               inside within N bars -> trapped traders.           |
//| Retest      : after a genuine structure break, price returns to  |
//|               the broken level and holds.                        |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Core/SymbolAdapter.mqh>
#include <ApexPA/PriceAction/SwingEngine.mqh>

struct ApexSweepEvent
  {
   bool                 valid;
   ENUM_APEX_DIRECTION  reversal_dir;   // direction to trade AFTER the sweep
   double               swept_level;
   datetime             time;
   double               quality;        // 0..1
  };

class CLiquidityEngine
  {
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_tf;
   CSymbolAdapter   *m_adapter;
   CSwingEngine     *m_swings;
   ApexSweepEvent    m_last_sweep;
   datetime          m_last_bar;

   //--- detect sweep on the last closed bar against recent unswept swings
   void              DetectSweep()
     {
      double h1 = iHigh(m_symbol, m_tf, 1);
      double l1 = iLow(m_symbol, m_tf, 1);
      double c1 = iClose(m_symbol, m_tf, 1);
      double o1 = iOpen(m_symbol, m_tf, 1);
      datetime t1 = iTime(m_symbol, m_tf, 1);
      double vol = m_adapter.VolatilityUnit(m_tf);
      if(vol <= 0) return;

      // sweep ABOVE: high pokes a resting swing high, close returns below it
      ApexSwing sw;
      int n = m_swings.Count();
      for(int i = n - 1; i >= MathMax(0, n - 60); i--)
        {
         if(!m_swings.Get(i, sw) || sw.swept || sw.time >= t1) continue;

         if(sw.type == SWING_HIGH && h1 > sw.price && c1 < sw.price)
           {
            double poke = (h1 - sw.price) / vol;               // depth of the raid
            double reject = (h1 - c1) / MathMax(h1 - l1, vol * 0.1);
            m_last_sweep.valid        = true;
            m_last_sweep.reversal_dir = DIR_SHORT;
            m_last_sweep.swept_level  = sw.price;
            m_last_sweep.time         = t1;
            m_last_sweep.quality      = MathMin(1.0, 0.4 + poke * 0.3 + reject * 0.3);
            if(c1 < o1) m_last_sweep.quality = MathMin(1.0, m_last_sweep.quality + 0.1);
            m_swings.MarkSwept(sw.time);
            return;
           }
         if(sw.type == SWING_LOW && l1 < sw.price && c1 > sw.price)
           {
            double poke = (sw.price - l1) / vol;
            double reject = (c1 - l1) / MathMax(h1 - l1, vol * 0.1);
            m_last_sweep.valid        = true;
            m_last_sweep.reversal_dir = DIR_LONG;
            m_last_sweep.swept_level  = sw.price;
            m_last_sweep.time         = t1;
            m_last_sweep.quality      = MathMin(1.0, 0.4 + poke * 0.3 + reject * 0.3);
            if(c1 > o1) m_last_sweep.quality = MathMin(1.0, m_last_sweep.quality + 0.1);
            m_swings.MarkSwept(sw.time);
            return;
           }
        }
     }

public:
                     CLiquidityEngine() : m_symbol(""), m_tf(PERIOD_CURRENT),
                                          m_adapter(NULL), m_swings(NULL), m_last_bar(0)
     {
      m_last_sweep.valid = false;
     }

   void              Init(const string symbol, const ENUM_TIMEFRAMES tf,
                          CSymbolAdapter *adapter, CSwingEngine *swings)
     {
      m_symbol  = symbol;
      m_tf      = tf;
      m_adapter = adapter;
      m_swings  = swings;
     }

   void              Update()
     {
      datetime bt = iTime(m_symbol, m_tf, 0);
      if(bt == m_last_bar || m_adapter == NULL || m_swings == NULL) return;
      m_last_bar = bt;
      DetectSweep();
     }

   //--- sweep is only actionable for a few bars after it happens
   bool              RecentSweep(ApexSweepEvent &out, const int max_age_bars = 3) const
     {
      if(!m_last_sweep.valid) return false;
      datetime cutoff = iTime(m_symbol, m_tf, MathMin(max_age_bars, iBars(m_symbol, m_tf) - 1));
      if(m_last_sweep.time < cutoff) return false;
      out = m_last_sweep;
      return true;
     }

   //--- false breakout of a horizontal level: bar[k] closed beyond,
   //--- bar[1] closed back inside (k in 2..max_bars)
   bool              FalseBreakout(const double level, ENUM_APEX_DIRECTION &fade_dir,
                                   const int max_bars = 4) const
     {
      double c1 = iClose(m_symbol, m_tf, 1);
      for(int k = 2; k <= max_bars; k++)
        {
         double ck = iClose(m_symbol, m_tf, k);
         if(ck > level && c1 < level) { fade_dir = DIR_SHORT; return true; }
         if(ck < level && c1 > level) { fade_dir = DIR_LONG;  return true; }
        }
      fade_dir = DIR_NONE;
      return false;
     }

   //--- breakout + retest of a broken structure level:
   //--- price broke `level` in `dir`, has since pulled back to within
   //--- tolerance of it, and the last closed bar holds the level.
   bool              BreakoutRetest(const double level, const ENUM_APEX_DIRECTION dir,
                                    const double tolerance) const
     {
      double c1 = iClose(m_symbol, m_tf, 1);
      double l1 = iLow(m_symbol, m_tf, 1);
      double h1 = iHigh(m_symbol, m_tf, 1);
      if(dir == DIR_LONG)
         return (l1 <= level + tolerance && c1 > level);
      if(dir == DIR_SHORT)
         return (h1 >= level - tolerance && c1 < level);
      return false;
     }
  };
//+------------------------------------------------------------------+
