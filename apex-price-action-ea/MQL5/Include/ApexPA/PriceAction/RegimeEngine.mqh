//+------------------------------------------------------------------+
//|                                                 RegimeEngine.mqh |
//| Market regime classification from raw price statistics.          |
//|                                                                  |
//| Uses only price-derived measurements (no indicator signals):     |
//|  - Efficiency ratio: |net move| / sum(|bar moves|) over N bars.  |
//|    High ratio  -> directional (trending), low -> choppy (range). |
//|  - Volatility percentile: current true-range average vs its own  |
//|    distribution over a long window -> high/low vol, expansion/   |
//|    compression transitions.                                      |
//| The signal engine only runs strategies suited to the regime.     |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>

class CRegimeEngine
  {
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_tf;
   int               m_er_period;        // efficiency ratio window
   int               m_vol_window;       // long window for vol percentile
   double            m_trend_threshold;  // ER above this = trending
   double            m_range_threshold;  // ER below this = ranging
   ENUM_APEX_REGIME  m_regime;
   ENUM_APEX_REGIME  m_vol_regime;
   double            m_efficiency;
   double            m_vol_percentile;
   datetime          m_last_bar;

   double            EfficiencyRatio(const int period) const
     {
      double net = MathAbs(iClose(m_symbol, m_tf, 1) - iClose(m_symbol, m_tf, period + 1));
      double path = 0;
      for(int i = 1; i <= period; i++)
         path += MathAbs(iClose(m_symbol, m_tf, i) - iClose(m_symbol, m_tf, i + 1));
      return (path > 0) ? net / path : 0;
     }

   double            AvgTrueRange(const int start, const int period) const
     {
      double sum = 0;
      for(int i = start; i < start + period; i++)
        {
         double tr = MathMax(iHigh(m_symbol, m_tf, i), iClose(m_symbol, m_tf, i + 1)) -
                     MathMin(iLow(m_symbol, m_tf, i),  iClose(m_symbol, m_tf, i + 1));
         sum += tr;
        }
      return sum / period;
     }

   //--- percentile rank of current short-window vol within long history
   double            VolPercentile() const
     {
      double current = AvgTrueRange(1, 14);
      int below = 0, total = 0;
      for(int s = 15; s < m_vol_window; s += 7)
        {
         double past = AvgTrueRange(s, 14);
         if(past < current) below++;
         total++;
        }
      return (total > 0) ? (double)below / total : 0.5;
     }

public:
                     CRegimeEngine() : m_symbol(""), m_tf(PERIOD_CURRENT),
                                       m_er_period(20), m_vol_window(400),
                                       m_trend_threshold(0.35), m_range_threshold(0.20),
                                       m_regime(REGIME_UNKNOWN), m_vol_regime(REGIME_UNKNOWN),
                                       m_efficiency(0), m_vol_percentile(0.5), m_last_bar(0) {}

   void              Init(const string symbol, const ENUM_TIMEFRAMES tf,
                          const int er_period = 20,
                          const double trend_threshold = 0.35,
                          const double range_threshold = 0.20)
     {
      m_symbol          = symbol;
      m_tf              = tf;
      m_er_period       = er_period;
      m_trend_threshold = trend_threshold;
      m_range_threshold = range_threshold;
     }

   void              Update()
     {
      datetime bt = iTime(m_symbol, m_tf, 0);
      if(bt == m_last_bar) return;
      if(iBars(m_symbol, m_tf) < m_vol_window + 20) return;
      m_last_bar = bt;

      m_efficiency     = EfficiencyRatio(m_er_period);
      m_vol_percentile = VolPercentile();

      // volatility regime
      if(m_vol_percentile >= 0.85)      m_vol_regime = REGIME_HIGH_VOLATILITY;
      else if(m_vol_percentile <= 0.15) m_vol_regime = REGIME_LOW_VOLATILITY;
      else                              m_vol_regime = REGIME_UNKNOWN;

      // expansion / compression transitions (short vol vs medium vol)
      double vol_now  = AvgTrueRange(1, 7);
      double vol_prev = AvgTrueRange(8, 21);
      bool expanding   = vol_prev > 0 && vol_now > vol_prev * 1.5;
      bool compressing = vol_prev > 0 && vol_now < vol_prev * 0.6;

      // primary regime
      if(expanding)
         m_regime = REGIME_EXPANSION;
      else if(compressing)
         m_regime = REGIME_COMPRESSION;
      else if(m_efficiency >= m_trend_threshold)
         m_regime = REGIME_TRENDING;
      else if(m_efficiency <= m_range_threshold)
         m_regime = REGIME_RANGING;
      else
         m_regime = REGIME_UNKNOWN;   // transitional - stand aside
     }

   ENUM_APEX_REGIME  Regime()        const { return m_regime; }
   ENUM_APEX_REGIME  VolRegime()     const { return m_vol_regime; }
   double            Efficiency()    const { return m_efficiency; }
   double            VolPercentileValue() const { return m_vol_percentile; }

   bool              AllowsStrategy(const ENUM_APEX_STRATEGY strat) const
     {
      switch(strat)
        {
         case STRAT_TREND_PULLBACK:
            return m_regime == REGIME_TRENDING || m_regime == REGIME_EXPANSION;
         case STRAT_LIQUIDITY_SWEEP:
            return m_regime == REGIME_RANGING || m_regime == REGIME_TRENDING ||
                   m_regime == REGIME_UNKNOWN;
         case STRAT_BREAKOUT_RETEST:
            return m_regime == REGIME_TRENDING || m_regime == REGIME_EXPANSION;
         case STRAT_FALSE_BREAKOUT:
            return m_regime == REGIME_RANGING;
         case STRAT_COMPRESSION_BREAK:
            return m_regime == REGIME_COMPRESSION;
         default:
            return false;
        }
     }
  };
//+------------------------------------------------------------------+
