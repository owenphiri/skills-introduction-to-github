//+------------------------------------------------------------------+
//|                                              StructureEngine.mqh |
//| Market structure state machine built on top of CSwingEngine.     |
//|                                                                  |
//| Tracks:                                                          |
//|  - trend state (bullish / bearish / pullback / consolidation)    |
//|  - Break of Structure (BOS)  = close beyond last same-side swing |
//|    in the direction of the prevailing trend (continuation)       |
//|  - Change of Character (CHoCH) = close beyond the swing that     |
//|    protects the prevailing trend (first sign of reversal)        |
//| All events are evaluated on CLOSED bars only (non-repainting).   |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/PriceAction/SwingEngine.mqh>

class CStructureEngine
  {
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_tf;
   CSwingEngine     *m_swings;           // not owned
   ENUM_APEX_TREND   m_trend;
   ENUM_APEX_STRUCTURE_EVENT m_last_event;
   datetime          m_last_event_time;
   double            m_last_event_level;
   datetime          m_last_bar;

   //--- most recent labelled structure snapshot
   ApexSwing         m_last_high;
   ApexSwing         m_last_low;
   bool              m_has_high, m_has_low;

   void              RefreshTrend()
     {
      // Trend from the last two labelled swings of each side.
      ApexSwing h0, h1, l0, l1;
      bool okh = m_swings.Last(SWING_HIGH, h0, 0) && m_swings.Last(SWING_HIGH, h1, 1);
      bool okl = m_swings.Last(SWING_LOW,  l0, 0) && m_swings.Last(SWING_LOW,  l1, 1);
      if(!okh || !okl) { m_trend = TREND_NONE; return; }

      bool hh = h0.price > h1.price;
      bool hl = l0.price > l1.price;
      bool lh = h0.price < h1.price;
      bool ll = l0.price < l1.price;

      double close0 = iClose(m_symbol, m_tf, 1);

      if(hh && hl)
         m_trend = (close0 < l0.price + (h0.price - l0.price) * 0.5) ? TREND_BULL_PULLBACK : TREND_BULLISH;
      else if(lh && ll)
         m_trend = (close0 > l0.price + (h0.price - l0.price) * 0.5) ? TREND_BEAR_PULLBACK : TREND_BEARISH;
      else
         m_trend = TREND_CONSOLIDATION;
     }

   void              DetectEvents()
     {
      // Use last CLOSED bar
      double close1 = iClose(m_symbol, m_tf, 1);
      datetime t1   = iTime(m_symbol, m_tf, 1);

      ApexSwing h0, l0;
      if(!m_swings.Last(SWING_HIGH, h0, 0) || !m_swings.Last(SWING_LOW, l0, 0))
         return;

      bool bull_bias = (m_trend == TREND_BULLISH || m_trend == TREND_BULL_PULLBACK);
      bool bear_bias = (m_trend == TREND_BEARISH || m_trend == TREND_BEAR_PULLBACK);

      // continuation breaks
      if(close1 > h0.price && h0.time != m_last_event_time)
        {
         m_last_event       = bull_bias ? STRUCT_BOS_BULL : STRUCT_CHOCH_BULL;
         m_last_event_time  = t1;
         m_last_event_level = h0.price;
         m_swings.MarkSwept(h0.time);
        }
      else if(close1 < l0.price && l0.time != m_last_event_time)
        {
         m_last_event       = bear_bias ? STRUCT_BOS_BEAR : STRUCT_CHOCH_BEAR;
         m_last_event_time  = t1;
         m_last_event_level = l0.price;
         m_swings.MarkSwept(l0.time);
        }
     }

public:
                     CStructureEngine() : m_symbol(""), m_tf(PERIOD_CURRENT), m_swings(NULL),
                                          m_trend(TREND_NONE), m_last_event(STRUCT_NONE),
                                          m_last_event_time(0), m_last_event_level(0),
                                          m_last_bar(0), m_has_high(false), m_has_low(false) {}

   void              Init(const string symbol, const ENUM_TIMEFRAMES tf, CSwingEngine *swings)
     {
      m_symbol = symbol;
      m_tf     = tf;
      m_swings = swings;
     }

   //--- call on every tick; internally gated to new closed bars
   void              Update()
     {
      datetime bt = iTime(m_symbol, m_tf, 0);
      if(bt == m_last_bar || m_swings == NULL) return;
      m_last_bar = bt;
      m_swings.Update();
      RefreshTrend();
      DetectEvents();
     }

   ENUM_APEX_TREND   Trend()          const { return m_trend; }
   ENUM_APEX_STRUCTURE_EVENT LastEvent() const { return m_last_event; }
   datetime          LastEventTime()  const { return m_last_event_time; }
   double            LastEventLevel() const { return m_last_event_level; }

   bool              IsBullish() const { return m_trend == TREND_BULLISH || m_trend == TREND_BULL_PULLBACK; }
   bool              IsBearish() const { return m_trend == TREND_BEARISH || m_trend == TREND_BEAR_PULLBACK; }

   //--- premium/discount: position of price inside the current dealing range
   //--- 0.0 = extreme discount (range low), 1.0 = extreme premium (range high)
   double            RangePosition() const
     {
      ApexSwing h0, l0;
      if(!m_swings.Last(SWING_HIGH, h0) || !m_swings.Last(SWING_LOW, l0)) return 0.5;
      double hi = h0.price, lo = l0.price;
      if(hi <= lo) return 0.5;
      double px = iClose(m_symbol, m_tf, 0);
      return MathMax(0.0, MathMin(1.0, (px - lo) / (hi - lo)));
     }
  };
//+------------------------------------------------------------------+
