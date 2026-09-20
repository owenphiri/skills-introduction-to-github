//+------------------------------------------------------------------+
//|                                                SymbolAdapter.mqh |
//| Adaptive instrument engine.                                      |
//|                                                                  |
//| Removes every hardcoded pip/point assumption from the system.    |
//| All modules ask this class for symbol-normalised quantities:     |
//|  - pip size / tick value / contract maths                        |
//|  - asset-class detection (forex/metal/index/commodity/crypto)    |
//|  - volatility unit (ATR computed from raw true range - used for  |
//|    risk normalisation ONLY, never as an entry signal)            |
//|  - broker constraints (min/max/step lot, stops level, freeze)    |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>

class CSymbolAdapter
  {
private:
   string            m_symbol;
   double            m_point;
   int               m_digits;
   double            m_pip;              // classic pip (10 points on 5/3-digit FX)
   double            m_tick_size;
   double            m_tick_value;
   double            m_lot_min;
   double            m_lot_max;
   double            m_lot_step;
   int               m_stops_level;
   ENUM_APEX_ASSET_CLASS m_asset_class;
   double            m_atr_cache;        // volatility unit, refreshed per bar
   datetime          m_atr_bar_time;
   ENUM_TIMEFRAMES   m_atr_tf;
   int               m_atr_period;

   ENUM_APEX_ASSET_CLASS ClassifySymbol() const
     {
      string s = m_symbol;
      StringToUpper(s);
      // crypto
      if(StringFind(s, "BTC") >= 0 || StringFind(s, "ETH") >= 0 ||
         StringFind(s, "XRP") >= 0 || StringFind(s, "SOL") >= 0 ||
         StringFind(s, "LTC") >= 0 || StringFind(s, "DOGE") >= 0 ||
         StringFind(s, "ADA") >= 0)
         return ASSET_CRYPTO;
      // metals
      if(StringFind(s, "XAU") >= 0 || StringFind(s, "GOLD") >= 0 ||
         StringFind(s, "XAG") >= 0 || StringFind(s, "SILVER") >= 0 ||
         StringFind(s, "XPT") >= 0 || StringFind(s, "XPD") >= 0)
         return ASSET_METAL;
      // indices
      if(StringFind(s, "US30") >= 0 || StringFind(s, "DJ") == 0    ||
         StringFind(s, "NAS") >= 0  || StringFind(s, "NDX") >= 0   ||
         StringFind(s, "US100") >= 0|| StringFind(s, "SPX") >= 0   ||
         StringFind(s, "US500") >= 0|| StringFind(s, "GER") >= 0   ||
         StringFind(s, "DAX") >= 0  || StringFind(s, "UK100") >= 0 ||
         StringFind(s, "FTSE") >= 0 || StringFind(s, "JP225") >= 0 ||
         StringFind(s, "AUS200") >= 0)
         return ASSET_INDEX;
      // commodities
      if(StringFind(s, "OIL") >= 0 || StringFind(s, "WTI") >= 0 ||
         StringFind(s, "BRENT") >= 0 || StringFind(s, "XTI") >= 0 ||
         StringFind(s, "XBR") >= 0 || StringFind(s, "NGAS") >= 0 ||
         StringFind(s, "NATGAS") >= 0 || StringFind(s, "XNG") >= 0)
         return ASSET_COMMODITY;
      // forex: base+quote both ISO currency codes
      string ccy = "USD EUR GBP JPY CHF AUD NZD CAD SGD NOK SEK MXN ZAR TRY PLN HKD CNH";
      if(StringLen(s) >= 6 &&
         StringFind(ccy, StringSubstr(s, 0, 3)) >= 0 &&
         StringFind(ccy, StringSubstr(s, 3, 3)) >= 0)
         return ASSET_FOREX;
      return ASSET_OTHER;
     }

public:
                     CSymbolAdapter() : m_symbol(""), m_atr_cache(0), m_atr_bar_time(0),
                                        m_atr_tf(PERIOD_H1), m_atr_period(14) {}

   bool              Init(const string symbol, const ENUM_TIMEFRAMES atr_tf = PERIOD_H1, const int atr_period = 14)
     {
      m_symbol      = symbol;
      m_point       = SymbolInfoDouble(symbol, SYMBOL_POINT);
      m_digits      = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      m_tick_size   = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      m_tick_value  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      m_lot_min     = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
      m_lot_max     = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
      m_lot_step    = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
      m_stops_level = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
      m_atr_tf      = atr_tf;
      m_atr_period  = atr_period;
      m_asset_class = ClassifySymbol();
      // pip convention: FX 5/3-digit -> 10 points, otherwise 1 point
      if(m_asset_class == ASSET_FOREX && (m_digits == 5 || m_digits == 3))
         m_pip = m_point * 10.0;
      else if(m_asset_class == ASSET_METAL && m_digits >= 2)
         m_pip = m_point * 10.0;
      else
         m_pip = m_point;
      return (m_point > 0 && m_tick_size > 0 && m_tick_value > 0);
     }

   string            Symbol()      const { return m_symbol; }
   double            Point()       const { return m_point; }
   int               Digits()      const { return m_digits; }
   double            Pip()         const { return m_pip; }
   double            LotMin()      const { return m_lot_min; }
   double            LotMax()      const { return m_lot_max; }
   double            LotStep()     const { return m_lot_step; }
   int               StopsLevel()  const { return m_stops_level; }
   ENUM_APEX_ASSET_CLASS AssetClass() const { return m_asset_class; }

   string            AssetClassName() const
     {
      switch(m_asset_class)
        {
         case ASSET_FOREX:     return "Forex";
         case ASSET_METAL:     return "Metal";
         case ASSET_INDEX:     return "Index";
         case ASSET_COMMODITY: return "Commodity";
         case ASSET_CRYPTO:    return "Crypto";
         default:              return "Other";
        }
     }

   //--- money value of one point of price movement for 1.0 lot
   double            PointValuePerLot() const
     {
      if(m_tick_size <= 0) return 0;
      return m_tick_value * (m_point / m_tick_size);
     }

   //--- money risked by `lots` over a stop distance in price units
   double            MoneyAtRisk(const double lots, const double sl_distance) const
     {
      if(m_point <= 0) return 0;
      return lots * (sl_distance / m_point) * PointValuePerLot();
     }

   //--- lots required to risk `risk_money` over `sl_distance` price units
   double            LotsForRisk(const double risk_money, const double sl_distance) const
     {
      double per_lot = MoneyAtRisk(1.0, sl_distance);
      if(per_lot <= 0) return 0;
      return NormalizeLots(risk_money / per_lot);
     }

   double            NormalizeLots(double lots) const
     {
      if(m_lot_step > 0)
         lots = MathFloor(lots / m_lot_step) * m_lot_step;
      lots = MathMax(lots, 0.0);
      lots = MathMin(lots, m_lot_max);
      // round to avoid float dust like 0.09999999
      return NormalizeDouble(lots, 8);
     }

   double            NormalizePrice(const double price) const
     {
      if(m_tick_size > 0)
         return NormalizeDouble(MathRound(price / m_tick_size) * m_tick_size, m_digits);
      return NormalizeDouble(price, m_digits);
     }

   double            SpreadPoints() const
     {
      MqlTick tick;
      if(!SymbolInfoTick(m_symbol, tick) || m_point <= 0) return 0;
      return (tick.ask - tick.bid) / m_point;
     }

   //--- Volatility unit: average true range computed from raw OHLC.
   //--- Used exclusively for risk normalisation, regime measurement,
   //--- stop buffers and trailing - never as an entry trigger.
   double            VolatilityUnit(const ENUM_TIMEFRAMES tf = PERIOD_CURRENT)
     {
      ENUM_TIMEFRAMES use_tf = (tf == PERIOD_CURRENT) ? m_atr_tf : tf;
      datetime bt = iTime(m_symbol, use_tf, 0);
      if(bt == m_atr_bar_time && m_atr_cache > 0 && tf == PERIOD_CURRENT)
         return m_atr_cache;

      MqlRates rates[];
      int need = m_atr_period + 2;
      if(CopyRates(m_symbol, use_tf, 0, need, rates) < need)
         return m_atr_cache; // stale but usable
      ArraySetAsSeries(rates, true);
      double sum = 0;
      for(int i = 1; i <= m_atr_period; i++)
        {
         double tr = MathMax(rates[i].high, rates[i + 1].close) -
                     MathMin(rates[i].low,  rates[i + 1].close);
         sum += tr;
        }
      double atr = sum / m_atr_period;
      if(tf == PERIOD_CURRENT)
        {
         m_atr_cache    = atr;
         m_atr_bar_time = bt;
        }
      return atr;
     }

   //--- round-number grid step adapted to the instrument's price scale
   double            RoundNumberStep() const
     {
      double price = SymbolInfoDouble(m_symbol, SYMBOL_BID);
      if(price <= 0) return 0;
      switch(m_asset_class)
        {
         case ASSET_FOREX:  return (StringFind(m_symbol, "JPY") >= 0) ? 0.50 : 0.0050;
         case ASSET_METAL:  return (price > 500) ? 10.0 : 0.50;   // gold vs silver
         case ASSET_INDEX:  return (price > 10000) ? 100.0 : 50.0;
         case ASSET_CRYPTO: return (price > 10000) ? 1000.0 : (price > 500 ? 50.0 : 1.0);
         default:           return MathPow(10, MathFloor(MathLog10(price)) - 2);
        }
     }

   //--- minimum broker-legal distance between price and a stop
   double            MinStopDistance() const
     {
      return MathMax(m_stops_level * m_point, SpreadPoints() * m_point * 1.5);
     }
  };
//+------------------------------------------------------------------+
