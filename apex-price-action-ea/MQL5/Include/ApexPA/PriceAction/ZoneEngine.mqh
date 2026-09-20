//+------------------------------------------------------------------+
//|                                                   ZoneEngine.mqh |
//| Supply & demand zones, order blocks and fair value gaps.         |
//|                                                                  |
//| Demand zone  : base candle(s) before a strong impulsive rally.   |
//| Supply zone  : base candle(s) before a strong impulsive drop.    |
//| Order block  : last opposite-colour candle before the impulse    |
//|                that breaks structure (optional module).          |
//| FVG          : 3-candle inefficiency where candle1.high <        |
//|                candle3.low (bullish) or candle1.low >            |
//|                candle3.high (bearish) (optional module).         |
//| Zones are invalidated once price closes through them.            |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Core/SymbolAdapter.mqh>

class CZoneEngine
  {
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_tf;
   CSymbolAdapter   *m_adapter;
   bool              m_use_ob;
   bool              m_use_fvg;
   double            m_impulse_factor;   // impulse body >= factor * vol unit
   ApexZone          m_zones[];
   datetime          m_last_bar;

   void              AddZone(const ENUM_APEX_ZONE_TYPE type, const double upper,
                             const double lower, const datetime created, const double strength)
     {
      if(upper <= lower) return;
      // reject duplicates overlapping an existing active zone of same type
      for(int i = 0; i < ArraySize(m_zones); i++)
         if(m_zones[i].active && m_zones[i].type == type &&
            lower < m_zones[i].upper && upper > m_zones[i].lower)
            return;
      int n = ArraySize(m_zones);
      if(n >= APEX_MAX_ZONES)
        {
         // recycle: drop oldest inactive, else oldest
         int drop = 0;
         for(int i = 0; i < n; i++)
            if(!m_zones[i].active) { drop = i; break; }
         for(int i = drop; i < n - 1; i++)
            m_zones[i] = m_zones[i + 1];
         n--;
         ArrayResize(m_zones, n);
        }
      ArrayResize(m_zones, n + 1);
      m_zones[n].type     = type;
      m_zones[n].upper    = upper;
      m_zones[n].lower    = lower;
      m_zones[n].created  = created;
      m_zones[n].touches  = 0;
      m_zones[n].active   = true;
      m_zones[n].strength = strength;
     }

   //--- scan a window of closed bars for impulses leaving bases
   void              DetectSupplyDemand()
     {
      double vol = m_adapter.VolatilityUnit(m_tf);
      if(vol <= 0) return;

      for(int i = 3; i <= 40; i++)
        {
         double body_i = MathAbs(iClose(m_symbol, m_tf, i) - iOpen(m_symbol, m_tf, i));
         if(body_i < vol * m_impulse_factor) continue;   // not impulsive

         bool bullish = iClose(m_symbol, m_tf, i) > iOpen(m_symbol, m_tf, i);
         int base = i + 1;
         double base_body = MathAbs(iClose(m_symbol, m_tf, base) - iOpen(m_symbol, m_tf, base));
         if(base_body > vol * 0.6) continue;             // base must be quiet

         double up = iHigh(m_symbol, m_tf, base);
         double dn = iLow(m_symbol, m_tf, base);
         double strength = MathMin(1.0, 0.4 + (body_i / vol) * 0.15);
         datetime t = iTime(m_symbol, m_tf, base);

         if(bullish)
            AddZone(ZONE_DEMAND, up, dn, t, strength);
         else
            AddZone(ZONE_SUPPLY, up, dn, t, strength);

         // order block: last opposite candle before the impulse
         if(m_use_ob)
           {
            for(int k = i + 1; k <= i + 5; k++)
              {
               bool opp = bullish ? (iClose(m_symbol, m_tf, k) < iOpen(m_symbol, m_tf, k))
                                  : (iClose(m_symbol, m_tf, k) > iOpen(m_symbol, m_tf, k));
               if(!opp) continue;
               AddZone(bullish ? ZONE_ORDER_BLOCK_BULL : ZONE_ORDER_BLOCK_BEAR,
                       iHigh(m_symbol, m_tf, k), iLow(m_symbol, m_tf, k),
                       iTime(m_symbol, m_tf, k), strength);
               break;
              }
           }
        }
     }

   void              DetectFVG()
     {
      if(!m_use_fvg) return;
      double vol = m_adapter.VolatilityUnit(m_tf);
      for(int i = 1; i <= 30; i++)
        {
         double h3 = iHigh(m_symbol, m_tf, i + 2);
         double l3 = iLow(m_symbol, m_tf, i + 2);
         double h1 = iHigh(m_symbol, m_tf, i);
         double l1 = iLow(m_symbol, m_tf, i);
         // bullish gap: candle3.high < candle1.low
         if(h3 < l1 && (l1 - h3) > vol * 0.15)
            AddZone(ZONE_FVG_BULL, l1, h3, iTime(m_symbol, m_tf, i + 1), 0.45);
         // bearish gap: candle3.low > candle1.high
         if(l3 > h1 && (l3 - h1) > vol * 0.15)
            AddZone(ZONE_FVG_BEAR, l3, h1, iTime(m_symbol, m_tf, i + 1), 0.45);
        }
     }

   void              InvalidateZones()
     {
      double close1 = iClose(m_symbol, m_tf, 1);
      for(int i = 0; i < ArraySize(m_zones); i++)
        {
         if(!m_zones[i].active) continue;
         bool is_demand = (m_zones[i].type == ZONE_DEMAND ||
                           m_zones[i].type == ZONE_ORDER_BLOCK_BULL ||
                           m_zones[i].type == ZONE_FVG_BULL);
         if(is_demand && close1 < m_zones[i].lower)
            m_zones[i].active = false;
         if(!is_demand && close1 > m_zones[i].upper)
            m_zones[i].active = false;
         // fade zones after repeated tests (each touch consumes orders)
         if(m_zones[i].touches >= 3)
            m_zones[i].active = false;
        }
     }

public:
                     CZoneEngine() : m_symbol(""), m_tf(PERIOD_CURRENT), m_adapter(NULL),
                                     m_use_ob(true), m_use_fvg(true),
                                     m_impulse_factor(1.2), m_last_bar(0) {}

   void              Init(const string symbol, const ENUM_TIMEFRAMES tf, CSymbolAdapter *adapter,
                          const bool use_order_blocks, const bool use_fvg,
                          const double impulse_factor = 1.2)
     {
      m_symbol         = symbol;
      m_tf             = tf;
      m_adapter        = adapter;
      m_use_ob         = use_order_blocks;
      m_use_fvg        = use_fvg;
      m_impulse_factor = impulse_factor;
     }

   void              Update()
     {
      datetime bt = iTime(m_symbol, m_tf, 0);
      if(bt == m_last_bar || m_adapter == NULL) return;
      m_last_bar = bt;
      DetectSupplyDemand();
      DetectFVG();
      InvalidateZones();
     }

   int               Count() const { return ArraySize(m_zones); }
   bool              Get(const int idx, ApexZone &out) const
     {
      if(idx < 0 || idx >= ArraySize(m_zones)) return false;
      out = m_zones[idx];
      return true;
     }

   //--- is price currently inside an active zone of the wanted side?
   //--- returns the best zone strength, 0 if none. Registers the touch.
   double            InZone(const double price, const ENUM_APEX_DIRECTION dir, ApexZone &out)
     {
      double best = 0;
      int best_i = -1;
      for(int i = 0; i < ArraySize(m_zones); i++)
        {
         if(!m_zones[i].active) continue;
         bool is_demand = (m_zones[i].type == ZONE_DEMAND ||
                           m_zones[i].type == ZONE_ORDER_BLOCK_BULL ||
                           m_zones[i].type == ZONE_FVG_BULL);
         if(dir == DIR_LONG && !is_demand) continue;
         if(dir == DIR_SHORT && is_demand) continue;
         if(price >= m_zones[i].lower && price <= m_zones[i].upper &&
            m_zones[i].strength > best)
           {
            best   = m_zones[i].strength;
            best_i = i;
           }
        }
      if(best_i >= 0)
        {
         m_zones[best_i].touches++;
         out = m_zones[best_i];
        }
      return best;
     }
  };
//+------------------------------------------------------------------+
