//+------------------------------------------------------------------+
//|                                                  LevelEngine.mqh |
//| Horizontal level detection:                                      |
//|  - support / resistance clusters from swing points               |
//|  - daily / weekly / monthly highs & lows (previous period)       |
//|  - session highs / lows (Asia, London, New York)                 |
//|  - round numbers & psychological levels (adaptive grid)          |
//| Provides proximity queries used for confluence scoring.          |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Core/SymbolAdapter.mqh>
#include <ApexPA/PriceAction/SwingEngine.mqh>

class CLevelEngine
  {
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_tf;
   CSymbolAdapter   *m_adapter;          // not owned
   CSwingEngine     *m_swings;           // not owned
   ApexLevel         m_levels[];
   datetime          m_last_bar;
   double            m_cluster_tol;      // price tolerance for clustering (vol-scaled)

   void              AddLevel(const ENUM_APEX_LEVEL_TYPE type, const double price,
                              const int touches = 1, const double strength = 0.5)
     {
      if(price <= 0) return;
      int n = ArraySize(m_levels);
      if(n >= APEX_MAX_LEVELS) return;
      ArrayResize(m_levels, n + 1);
      m_levels[n].type       = type;
      m_levels[n].price      = price;
      m_levels[n].touches    = touches;
      m_levels[n].last_touch = TimeCurrent();
      m_levels[n].strength   = strength;
     }

   //--- cluster swing points into S/R levels
   void              BuildSwingClusters()
     {
      int n = m_swings.Count();
      if(n < 4) return;

      double px = iClose(m_symbol, m_tf, 0);

      // greedy clustering over recent swings
      for(int i = n - 1; i >= MathMax(0, n - 120); i--)
        {
         ApexSwing sw;
         if(!m_swings.Get(i, sw)) continue;

         // does it merge into an existing cluster?
         bool merged = false;
         for(int j = 0; j < ArraySize(m_levels); j++)
           {
            if(m_levels[j].type != LEVEL_SUPPORT && m_levels[j].type != LEVEL_RESISTANCE)
               continue;
            if(MathAbs(m_levels[j].price - sw.price) <= m_cluster_tol)
              {
               // weighted average anchor + touch count
               m_levels[j].price = (m_levels[j].price * m_levels[j].touches + sw.price) /
                                   (m_levels[j].touches + 1);
               m_levels[j].touches++;
               m_levels[j].strength = MathMin(1.0, 0.3 + 0.15 * m_levels[j].touches);
               if(sw.time > m_levels[j].last_touch) m_levels[j].last_touch = sw.time;
               merged = true;
               break;
              }
           }
         if(!merged)
            AddLevel(sw.price > px ? LEVEL_RESISTANCE : LEVEL_SUPPORT, sw.price, 1, 0.35);
        }
     }

   void              BuildPeriodLevels()
     {
      // previous completed period extremes - the classic institutional levels
      AddLevel(LEVEL_DAILY_HIGH,   iHigh(m_symbol, PERIOD_D1, 1), 1, 0.70);
      AddLevel(LEVEL_DAILY_LOW,    iLow(m_symbol,  PERIOD_D1, 1), 1, 0.70);
      AddLevel(LEVEL_WEEKLY_HIGH,  iHigh(m_symbol, PERIOD_W1, 1), 1, 0.85);
      AddLevel(LEVEL_WEEKLY_LOW,   iLow(m_symbol,  PERIOD_W1, 1), 1, 0.85);
      AddLevel(LEVEL_MONTHLY_HIGH, iHigh(m_symbol, PERIOD_MN1, 1), 1, 0.95);
      AddLevel(LEVEL_MONTHLY_LOW,  iLow(m_symbol,  PERIOD_MN1, 1), 1, 0.95);
      // current day extremes (intraday liquidity magnets)
      AddLevel(LEVEL_SESSION_HIGH, iHigh(m_symbol, PERIOD_D1, 0), 1, 0.55);
      AddLevel(LEVEL_SESSION_LOW,  iLow(m_symbol,  PERIOD_D1, 0), 1, 0.55);
     }

   void              BuildRoundNumbers()
     {
      double step = m_adapter.RoundNumberStep();
      if(step <= 0) return;
      double px = iClose(m_symbol, m_tf, 0);
      double base = MathFloor(px / step) * step;
      // 3 levels each side of price
      for(int k = -3; k <= 3; k++)
        {
         double lvl = base + k * step;
         if(lvl <= 0) continue;
         // "big figure" levels (multiples of 10 grid steps) score higher
         bool big = MathAbs(MathMod(lvl, step * 10.0)) < step * 0.01;
         AddLevel(big ? LEVEL_PSYCHOLOGICAL : LEVEL_ROUND_NUMBER, lvl, 1, big ? 0.60 : 0.40);
        }
     }

public:
                     CLevelEngine() : m_symbol(""), m_tf(PERIOD_CURRENT), m_adapter(NULL),
                                      m_swings(NULL), m_last_bar(0), m_cluster_tol(0) {}

   void              Init(const string symbol, const ENUM_TIMEFRAMES tf,
                          CSymbolAdapter *adapter, CSwingEngine *swings)
     {
      m_symbol  = symbol;
      m_tf      = tf;
      m_adapter = adapter;
      m_swings  = swings;
     }

   //--- rebuild once per bar (levels are slow-moving state)
   void              Update()
     {
      datetime bt = iTime(m_symbol, m_tf, 0);
      if(bt == m_last_bar || m_adapter == NULL || m_swings == NULL) return;
      m_last_bar = bt;

      m_cluster_tol = m_adapter.VolatilityUnit() * 0.5;
      ArrayResize(m_levels, 0);
      BuildPeriodLevels();
      BuildRoundNumbers();
      BuildSwingClusters();
     }

   int               Count() const { return ArraySize(m_levels); }
   bool              Get(const int idx, ApexLevel &out) const
     {
      if(idx < 0 || idx >= ArraySize(m_levels)) return false;
      out = m_levels[idx];
      return true;
     }

   //--- strongest level within `tolerance` of price; returns strength or 0
   double            NearestLevel(const double price, const double tolerance, ApexLevel &out) const
     {
      double best = 0;
      for(int i = 0; i < ArraySize(m_levels); i++)
        {
         if(MathAbs(m_levels[i].price - price) > tolerance) continue;
         if(m_levels[i].strength > best)
           {
            best = m_levels[i].strength;
            out  = m_levels[i];
           }
        }
      return best;
     }

   //--- nearest level strictly above / below (for TP placement)
   bool              NextLevelAbove(const double price, double &out_price) const
     {
      double best = DBL_MAX;
      for(int i = 0; i < ArraySize(m_levels); i++)
         if(m_levels[i].price > price && m_levels[i].price < best)
            best = m_levels[i].price;
      if(best == DBL_MAX) return false;
      out_price = best;
      return true;
     }

   bool              NextLevelBelow(const double price, double &out_price) const
     {
      double best = -DBL_MAX;
      for(int i = 0; i < ArraySize(m_levels); i++)
         if(m_levels[i].price < price && m_levels[i].price > best)
            best = m_levels[i].price;
      if(best == -DBL_MAX) return false;
      out_price = best;
      return true;
     }
  };
//+------------------------------------------------------------------+
