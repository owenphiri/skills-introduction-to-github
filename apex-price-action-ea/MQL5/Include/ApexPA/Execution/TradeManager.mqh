//+------------------------------------------------------------------+
//|                                                 TradeManager.mqh |
//| Open-position lifecycle management.                              |
//|                                                                  |
//|  - automatic break-even after +X R                               |
//|  - partial profit taking at +Y R                                 |
//|  - smart trailing: structure-based (behind last swing) with a    |
//|    volatility floor; emergency ATR stop as a hard backstop       |
//| All rules operate in R-multiples so behaviour is identical       |
//| across instruments.                                              |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Core/SymbolAdapter.mqh>
#include <ApexPA/Core/Logger.mqh>
#include <ApexPA/Execution/ExecutionEngine.mqh>
#include <ApexPA/PriceAction/SwingEngine.mqh>

struct ApexManageConfig
  {
   bool              use_break_even;
   double            be_trigger_r;        // move SL to BE at +X R
   double            be_offset_r;         // lock small profit (e.g. 0.1R)
   bool              use_partial;
   double            partial_trigger_r;   // take partial at +Y R
   double            partial_close_pct;   // % of volume to close
   bool              use_trailing;
   double            trail_start_r;       // start trailing at +Z R
   double            trail_atr_mult;      // volatility floor distance
   bool              trail_use_structure; // trail behind swing lows/highs
  };

class CTradeManager
  {
private:
   ApexManageConfig  m_cfg;
   CSymbolAdapter   *m_adapter;
   CExecutionEngine *m_exec;
   CSwingEngine     *m_swings;            // execution-TF swings for structure trail

   ulong             m_partial_done[];    // positions already partially closed

   bool              PartialDone(const ulong ticket) const
     {
      for(int i = 0; i < ArraySize(m_partial_done); i++)
         if(m_partial_done[i] == ticket) return true;
      return false;
     }

   void              MarkPartial(const ulong ticket)
     {
      int n = ArraySize(m_partial_done);
      ArrayResize(m_partial_done, n + 1);
      m_partial_done[n] = ticket;
     }

   //--- initial risk per unit from position open price & original SL.
   //--- We store the original SL distance in the position comment-free
   //--- way: use current SL if it is still on the loss side, otherwise
   //--- fall back to a volatility unit (SL already moved to profit).
   double            InitialRiskDistance(const double open, const double sl,
                                         const ENUM_APEX_DIRECTION dir) const
     {
      double dist = MathAbs(open - sl);
      bool sl_on_loss_side = (dir == DIR_LONG) ? (sl < open) : (sl > open);
      if(sl > 0 && sl_on_loss_side && dist > m_adapter.Point())
         return dist;
      return m_adapter.VolatilityUnit();  // conservative fallback
     }

public:
                     CTradeManager() : m_adapter(NULL), m_exec(NULL), m_swings(NULL) {}

   void              Init(const ApexManageConfig &cfg, CSymbolAdapter *adapter,
                          CExecutionEngine *exec, CSwingEngine *swings)
     {
      m_cfg     = cfg;
      m_adapter = adapter;
      m_exec    = exec;
      m_swings  = swings;
     }

   //--- manage every EA position on this symbol; call once per tick
   void              Manage()
     {
      string symbol = m_adapter.Symbol();
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0) continue;
         if(PositionGetInteger(POSITION_MAGIC) != m_exec.Magic()) continue;
         if(PositionGetString(POSITION_SYMBOL) != symbol) continue;

         long   ptype = PositionGetInteger(POSITION_TYPE);
         ENUM_APEX_DIRECTION dir = (ptype == POSITION_TYPE_BUY) ? DIR_LONG : DIR_SHORT;
         double open  = PositionGetDouble(POSITION_PRICE_OPEN);
         double sl    = PositionGetDouble(POSITION_SL);
         double tp    = PositionGetDouble(POSITION_TP);
         double vol   = PositionGetDouble(POSITION_VOLUME);
         double px    = PositionGetDouble(POSITION_PRICE_CURRENT);

         double risk = InitialRiskDistance(open, sl, dir);
         if(risk <= 0) continue;
         double r_now = (dir == DIR_LONG) ? (px - open) / risk : (open - px) / risk;

         // 1) partial profit
         if(m_cfg.use_partial && !PartialDone(ticket) && r_now >= m_cfg.partial_trigger_r)
           {
            double close_lots = m_adapter.NormalizeLots(vol * m_cfg.partial_close_pct / 100.0);
            if(close_lots >= m_adapter.LotMin() && close_lots < vol)
              {
               if(m_exec.ClosePosition(ticket, close_lots, "partial@+" +
                                       DoubleToString(m_cfg.partial_trigger_r, 1) + "R"))
                  MarkPartial(ticket);
              }
            else
               MarkPartial(ticket); // volume too small to split
           }

         // 2) break-even
         if(m_cfg.use_break_even && r_now >= m_cfg.be_trigger_r)
           {
            double be = (dir == DIR_LONG) ? open + risk * m_cfg.be_offset_r
                                          : open - risk * m_cfg.be_offset_r;
            bool improves = (dir == DIR_LONG) ? (be > sl || sl == 0) : (be < sl || sl == 0);
            if(improves)
               m_exec.ModifyStops(ticket, be, tp);
           }

         // 3) trailing
         if(m_cfg.use_trailing && r_now >= m_cfg.trail_start_r)
           {
            double vol_unit = m_adapter.VolatilityUnit();
            double trail_sl = 0;

            if(m_cfg.trail_use_structure && m_swings != NULL)
              {
               // behind the most recent confirmed swing on the trade side
               ApexSwing sw;
               if(dir == DIR_LONG && m_swings.Last(SWING_LOW, sw))
                  trail_sl = sw.price - vol_unit * 0.25;
               if(dir == DIR_SHORT && m_swings.Last(SWING_HIGH, sw))
                  trail_sl = sw.price + vol_unit * 0.25;
              }

            // volatility floor: never trail tighter than atr_mult * vol
            double vol_sl = (dir == DIR_LONG) ? px - vol_unit * m_cfg.trail_atr_mult
                                              : px + vol_unit * m_cfg.trail_atr_mult;
            if(trail_sl <= 0)
               trail_sl = vol_sl;
            else
               trail_sl = (dir == DIR_LONG) ? MathMin(trail_sl, vol_sl + vol_unit) // sanity clamp
                                            : MathMax(trail_sl, vol_sl - vol_unit);

            bool improves = (dir == DIR_LONG) ? (trail_sl > sl)
                                              : (sl == 0 || trail_sl < sl);
            if(improves)
               m_exec.ModifyStops(ticket, trail_sl, tp);
           }
        }
     }

   //--- forget partial-close markers for positions that no longer exist
   void              GarbageCollect()
     {
      for(int i = ArraySize(m_partial_done) - 1; i >= 0; i--)
        {
         if(!PositionSelectByTicket(m_partial_done[i]))
           {
            for(int j = i; j < ArraySize(m_partial_done) - 1; j++)
               m_partial_done[j] = m_partial_done[j + 1];
            ArrayResize(m_partial_done, ArraySize(m_partial_done) - 1);
           }
        }
     }
  };
//+------------------------------------------------------------------+
