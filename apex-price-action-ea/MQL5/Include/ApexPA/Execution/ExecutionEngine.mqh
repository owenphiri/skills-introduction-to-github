//+------------------------------------------------------------------+
//|                                              ExecutionEngine.mqh |
//| Smart order routing layer.                                       |
//|                                                                  |
//|  - spread & slippage gating before every order                   |
//|  - retry with backoff on transient trade-server errors           |
//|  - broker stop-level compliant SL/TP normalisation               |
//|  - duplicate-trade prevention (one signal-bar = one trade)       |
//|  - partial fill handling (IOC remainder tracking)                |
//|  - execution latency measurement for the dashboard               |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Core/SymbolAdapter.mqh>
#include <ApexPA/Core/Logger.mqh>

class CExecutionEngine
  {
private:
   CSymbolAdapter   *m_adapter;
   long              m_magic;
   double            m_max_spread_points;
   int               m_max_slippage_points;
   int               m_max_retries;
   datetime          m_last_signal_bar;    // duplicate prevention
   double            m_last_latency_ms;
   double            m_last_slippage_points;

   bool              IsRetryable(const uint retcode) const
     {
      switch(retcode)
        {
         case TRADE_RETCODE_REQUOTE:
         case TRADE_RETCODE_PRICE_CHANGED:
         case TRADE_RETCODE_PRICE_OFF:
         case TRADE_RETCODE_TIMEOUT:
         case TRADE_RETCODE_CONNECTION:
         case TRADE_RETCODE_TOO_MANY_REQUESTS:
            return true;
         default:
            return false;
        }
     }

public:
                     CExecutionEngine() : m_adapter(NULL), m_magic(APEX_MAGIC_DEFAULT),
                                          m_max_spread_points(0), m_max_slippage_points(30),
                                          m_max_retries(3), m_last_signal_bar(0),
                                          m_last_latency_ms(0), m_last_slippage_points(0) {}

   void              Init(CSymbolAdapter *adapter, const long magic,
                          const double max_spread_points, const int max_slippage_points,
                          const int max_retries = 3)
     {
      m_adapter             = adapter;
      m_magic               = magic;
      m_max_spread_points   = max_spread_points;
      m_max_slippage_points = max_slippage_points;
      m_max_retries         = max_retries;
     }

   long              Magic() const { return m_magic; }
   double            LastLatencyMs() const { return m_last_latency_ms; }
   double            LastSlippagePoints() const { return m_last_slippage_points; }

   bool              SpreadOK() const
     {
      if(m_max_spread_points <= 0) return true;
      return m_adapter.SpreadPoints() <= m_max_spread_points;
     }

   bool              AlreadyTradedBar(const datetime bar_time) const
     {
      return bar_time == m_last_signal_bar;
     }

   //--- market entry with SL/TP; returns position ticket or 0
   ulong             OpenMarket(const ENUM_APEX_DIRECTION dir, double lots,
                                double sl, double tp, const string comment,
                                const datetime signal_bar)
     {
      if(dir == DIR_NONE || lots <= 0) return 0;
      if(AlreadyTradedBar(signal_bar))
        {
         ApexLog.Debug("Duplicate trade prevented for bar " + TimeToString(signal_bar));
         return 0;
        }
      if(!SpreadOK())
        {
         ApexLog.Info(StringFormat("Entry skipped: spread %.1f pts > cap %.1f",
                      m_adapter.SpreadPoints(), m_max_spread_points));
         return 0;
        }

      string symbol = m_adapter.Symbol();
      MqlTradeRequest  req;
      MqlTradeResult   res;
      ZeroMemory(req);
      ZeroMemory(res);

      double remaining = lots;
      ulong  ticket    = 0;
      int    attempt   = 0;

      while(remaining >= m_adapter.LotMin() && attempt <= m_max_retries)
        {
         MqlTick tick;
         if(!SymbolInfoTick(symbol, tick)) return 0;
         double price = (dir == DIR_LONG) ? tick.ask : tick.bid;

         // broker minimum stop distance compliance
         double min_dist = m_adapter.MinStopDistance();
         if(sl > 0 && MathAbs(price - sl) < min_dist)
            sl = (dir == DIR_LONG) ? price - min_dist : price + min_dist;
         if(tp > 0 && MathAbs(price - tp) < min_dist)
            tp = (dir == DIR_LONG) ? price + min_dist : price - min_dist;

         req.action       = TRADE_ACTION_DEAL;
         req.symbol       = symbol;
         req.volume       = m_adapter.NormalizeLots(remaining);
         req.type         = (dir == DIR_LONG) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
         req.price        = price;
         req.sl           = m_adapter.NormalizePrice(sl);
         req.tp           = m_adapter.NormalizePrice(tp);
         req.deviation    = m_max_slippage_points;
         req.magic        = m_magic;
         req.comment      = comment;
         req.type_filling = ORDER_FILLING_IOC;

         // brokers differ in supported filling modes
         long filling = SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
         if((filling & SYMBOL_FILLING_IOC) == 0)
            req.type_filling = ((filling & SYMBOL_FILLING_FOK) != 0) ? ORDER_FILLING_FOK
                                                                     : ORDER_FILLING_RETURN;

         ulong t0 = GetMicrosecondCount();
         bool sent = OrderSend(req, res);
         m_last_latency_ms = (GetMicrosecondCount() - t0) / 1000.0;

         if(sent && (res.retcode == TRADE_RETCODE_DONE ||
                     res.retcode == TRADE_RETCODE_DONE_PARTIAL ||
                     res.retcode == TRADE_RETCODE_PLACED))
           {
            ticket = res.order;
            m_last_slippage_points = (res.price > 0 && m_adapter.Point() > 0)
                                     ? MathAbs(res.price - price) / m_adapter.Point() : 0;
            double filled = (res.volume > 0) ? res.volume : remaining;
            remaining -= filled;
            ApexLog.Info(StringFormat("%s %s %.2f lots @ %.5f (sl=%.5f tp=%.5f) latency=%.1fms slip=%.1fpts [%s]",
                          dir == DIR_LONG ? "BUY" : "SELL", symbol, filled, res.price,
                          req.sl, req.tp, m_last_latency_ms, m_last_slippage_points, comment));
            if(res.retcode == TRADE_RETCODE_DONE) break; // fully filled
            attempt++;   // partial fill: retry remainder
            continue;
           }

         if(sent && IsRetryable(res.retcode))
           {
            attempt++;
            ApexLog.Warn(StringFormat("Retryable trade error %u (attempt %d/%d)",
                         res.retcode, attempt, m_max_retries));
            Sleep((int)(500 * MathPow(2, attempt - 1)));   // 0.5s, 1s, 2s backoff
            continue;
           }

         ApexLog.Error(StringFormat("OrderSend failed: retcode=%u comment=%s", res.retcode, res.comment));
         break;
        }

      if(ticket != 0)
         m_last_signal_bar = signal_bar;
      return ticket;
     }

   //--- close (part of) a position by ticket
   bool              ClosePosition(const ulong position_ticket, double lots = 0,
                                   const string reason = "")
     {
      if(!PositionSelectByTicket(position_ticket)) return false;
      string symbol = PositionGetString(POSITION_SYMBOL);
      long   ptype  = PositionGetInteger(POSITION_TYPE);
      double pvol   = PositionGetDouble(POSITION_VOLUME);
      if(lots <= 0 || lots > pvol) lots = pvol;

      MqlTradeRequest req;
      MqlTradeResult  res;
      ZeroMemory(req);
      ZeroMemory(res);
      MqlTick tick;
      if(!SymbolInfoTick(symbol, tick)) return false;

      req.action    = TRADE_ACTION_DEAL;
      req.symbol    = symbol;
      req.position  = position_ticket;
      req.volume    = lots;
      req.type      = (ptype == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
      req.price     = (ptype == POSITION_TYPE_BUY) ? tick.bid : tick.ask;
      req.deviation = m_max_slippage_points;
      req.magic     = m_magic;
      req.comment   = StringSubstr("X:" + reason, 0, 31);
      req.type_filling = ORDER_FILLING_IOC;
      long filling = SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
      if((filling & SYMBOL_FILLING_IOC) == 0)
         req.type_filling = ((filling & SYMBOL_FILLING_FOK) != 0) ? ORDER_FILLING_FOK
                                                                  : ORDER_FILLING_RETURN;

      for(int attempt = 0; attempt <= m_max_retries; attempt++)
        {
         if(OrderSend(req, res) &&
            (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_DONE_PARTIAL))
           {
            ApexLog.Info(StringFormat("Closed %.2f lots of #%I64u (%s)", lots, position_ticket, reason));
            return true;
           }
         if(!IsRetryable(res.retcode)) break;
         Sleep((int)(500 * MathPow(2, attempt)));
         if(!SymbolInfoTick(symbol, tick)) break;
         req.price = (ptype == POSITION_TYPE_BUY) ? tick.bid : tick.ask;
        }
      ApexLog.Error(StringFormat("Close failed for #%I64u retcode=%u", position_ticket, res.retcode));
      return false;
     }

   bool              ModifyStops(const ulong position_ticket, const double sl, const double tp)
     {
      if(!PositionSelectByTicket(position_ticket)) return false;
      double cur_sl = PositionGetDouble(POSITION_SL);
      double cur_tp = PositionGetDouble(POSITION_TP);
      double nsl = m_adapter.NormalizePrice(sl);
      double ntp = m_adapter.NormalizePrice(tp);
      if(MathAbs(nsl - cur_sl) < m_adapter.Point() && MathAbs(ntp - cur_tp) < m_adapter.Point())
         return true; // nothing to change

      MqlTradeRequest req;
      MqlTradeResult  res;
      ZeroMemory(req);
      ZeroMemory(res);
      req.action   = TRADE_ACTION_SLTP;
      req.symbol   = PositionGetString(POSITION_SYMBOL);
      req.position = position_ticket;
      req.sl       = nsl;
      req.tp       = ntp;
      req.magic    = m_magic;
      if(OrderSend(req, res) && res.retcode == TRADE_RETCODE_DONE)
         return true;
      ApexLog.Warn(StringFormat("Stop modify failed #%I64u retcode=%u", position_ticket, res.retcode));
      return false;
     }

   //--- flatten all EA positions (equity guard / weekend close)
   void              CloseAll(const string reason)
     {
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0) continue;
         if(PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         ClosePosition(ticket, 0, reason);
        }
     }
  };
//+------------------------------------------------------------------+
