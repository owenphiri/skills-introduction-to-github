//+------------------------------------------------------------------+
//|                                                  Definitions.mqh |
//|                     ApexPA - Institutional Price Action EA Core  |
//|                                                                  |
//| Shared enumerations, structures and constants used by every      |
//| module.  This file has no dependencies and must stay that way.   |
//+------------------------------------------------------------------+
#property copyright "ApexPA"

#define APEX_VERSION        "1.0.0"
#define APEX_MAGIC_DEFAULT  86452301
#define APEX_MAX_SWINGS     512
#define APEX_MAX_ZONES      128
#define APEX_MAX_LEVELS     256

//+------------------------------------------------------------------+
//| Instrument classification                                        |
//+------------------------------------------------------------------+
enum ENUM_APEX_ASSET_CLASS
  {
   ASSET_FOREX,        // Forex pair
   ASSET_METAL,        // Gold / Silver / metals
   ASSET_INDEX,        // Equity index CFD (US30, NAS100, ...)
   ASSET_COMMODITY,    // Oil, NatGas, softs
   ASSET_CRYPTO,       // BTC, ETH, alts
   ASSET_OTHER         // Anything else
  };

//+------------------------------------------------------------------+
//| Market regime                                                    |
//+------------------------------------------------------------------+
enum ENUM_APEX_REGIME
  {
   REGIME_UNKNOWN,
   REGIME_TRENDING,
   REGIME_RANGING,
   REGIME_EXPANSION,       // volatility breakout phase
   REGIME_COMPRESSION,     // volatility contraction phase
   REGIME_HIGH_VOLATILITY,
   REGIME_LOW_VOLATILITY,
   REGIME_NEWS             // inside a protected news window
  };

//+------------------------------------------------------------------+
//| Trend state derived from market structure                        |
//+------------------------------------------------------------------+
enum ENUM_APEX_TREND
  {
   TREND_NONE,
   TREND_BULLISH,          // sequence of HH / HL
   TREND_BEARISH,          // sequence of LH / LL
   TREND_BULL_PULLBACK,    // bullish structure, corrective leg down
   TREND_BEAR_PULLBACK,    // bearish structure, corrective leg up
   TREND_CONSOLIDATION     // overlapping structure
  };

//+------------------------------------------------------------------+
//| Swing point label                                                |
//+------------------------------------------------------------------+
enum ENUM_APEX_SWING_TYPE
  {
   SWING_HIGH,
   SWING_LOW
  };

enum ENUM_APEX_SWING_LABEL
  {
   LABEL_NONE,
   LABEL_HH,               // higher high
   LABEL_HL,               // higher low
   LABEL_LH,               // lower high
   LABEL_LL                // lower low
  };

//+------------------------------------------------------------------+
//| Structure events                                                 |
//+------------------------------------------------------------------+
enum ENUM_APEX_STRUCTURE_EVENT
  {
   STRUCT_NONE,
   STRUCT_BOS_BULL,        // break of structure upward (continuation)
   STRUCT_BOS_BEAR,        // break of structure downward (continuation)
   STRUCT_CHOCH_BULL,      // change of character to bullish (reversal)
   STRUCT_CHOCH_BEAR       // change of character to bearish (reversal)
  };

//+------------------------------------------------------------------+
//| Candle patterns                                                  |
//+------------------------------------------------------------------+
enum ENUM_APEX_CANDLE
  {
   CANDLE_NONE,
   CANDLE_PIN_BULL,
   CANDLE_PIN_BEAR,
   CANDLE_ENGULF_BULL,
   CANDLE_ENGULF_BEAR,
   CANDLE_INSIDE,
   CANDLE_OUTSIDE_BULL,
   CANDLE_OUTSIDE_BEAR
  };

//+------------------------------------------------------------------+
//| Zone types                                                       |
//+------------------------------------------------------------------+
enum ENUM_APEX_ZONE_TYPE
  {
   ZONE_DEMAND,
   ZONE_SUPPLY,
   ZONE_ORDER_BLOCK_BULL,
   ZONE_ORDER_BLOCK_BEAR,
   ZONE_FVG_BULL,          // bullish fair value gap
   ZONE_FVG_BEAR           // bearish fair value gap
  };

//+------------------------------------------------------------------+
//| Level types                                                      |
//+------------------------------------------------------------------+
enum ENUM_APEX_LEVEL_TYPE
  {
   LEVEL_SUPPORT,
   LEVEL_RESISTANCE,
   LEVEL_DAILY_HIGH,
   LEVEL_DAILY_LOW,
   LEVEL_WEEKLY_HIGH,
   LEVEL_WEEKLY_LOW,
   LEVEL_MONTHLY_HIGH,
   LEVEL_MONTHLY_LOW,
   LEVEL_SESSION_HIGH,
   LEVEL_SESSION_LOW,
   LEVEL_ROUND_NUMBER,
   LEVEL_PSYCHOLOGICAL
  };

//+------------------------------------------------------------------+
//| Strategy / signal identification                                 |
//+------------------------------------------------------------------+
enum ENUM_APEX_STRATEGY
  {
   STRAT_NONE,
   STRAT_TREND_PULLBACK,      // HTF trend + pullback into zone/level
   STRAT_LIQUIDITY_SWEEP,     // sweep of liquidity + reversal
   STRAT_BREAKOUT_RETEST,     // structure break + retest
   STRAT_FALSE_BREAKOUT,      // failed breakout fade at a key level
   STRAT_COMPRESSION_BREAK    // compression -> expansion breakout
  };

enum ENUM_APEX_DIRECTION
  {
   DIR_NONE = 0,
   DIR_LONG = 1,
   DIR_SHORT = -1
  };

//+------------------------------------------------------------------+
//| Prop firm presets                                                |
//+------------------------------------------------------------------+
enum ENUM_APEX_PROP_FIRM
  {
   PROP_NONE,           // live / personal account (no challenge limits)
   PROP_FTMO,
   PROP_FUNDEDNEXT,
   PROP_FUNDINGPIPS,
   PROP_BLUE_GUARDIAN,
   PROP_HOLA_PRIME,
   PROP_CK_CAPITAL,
   PROP_BLUEBERRY,
   PROP_EIGHTCAP,
   PROP_CUSTOM          // fully user-configured rules
  };

//+------------------------------------------------------------------+
//| Trading permission state (why trading is allowed/blocked)        |
//+------------------------------------------------------------------+
enum ENUM_APEX_TRADE_STATE
  {
   STATE_TRADING,
   STATE_BLOCKED_DAILY_DD,
   STATE_BLOCKED_OVERALL_DD,
   STATE_BLOCKED_WEEKLY_DD,
   STATE_BLOCKED_NEWS,
   STATE_BLOCKED_SESSION,
   STATE_BLOCKED_SPREAD,
   STATE_BLOCKED_MAX_TRADES,
   STATE_BLOCKED_CONSEC_LOSS,
   STATE_BLOCKED_PROFIT_LOCK,
   STATE_BLOCKED_WEEKEND,
   STATE_BLOCKED_HOLIDAY,
   STATE_BLOCKED_REGIME,
   STATE_BLOCKED_TARGET_REACHED,
   STATE_BLOCKED_EQUITY_GUARD
  };

//+------------------------------------------------------------------+
//| Swing point                                                      |
//+------------------------------------------------------------------+
struct ApexSwing
  {
   datetime               time;
   double                 price;
   int                    bar_index;      // as-series index at detection time
   ENUM_APEX_SWING_TYPE   type;
   ENUM_APEX_SWING_LABEL  label;
   bool                   swept;          // liquidity above/below taken?
  };

//+------------------------------------------------------------------+
//| Supply / demand / OB / FVG zone                                  |
//+------------------------------------------------------------------+
struct ApexZone
  {
   ENUM_APEX_ZONE_TYPE    type;
   double                 upper;
   double                 lower;
   datetime               created;
   int                    touches;
   bool                   active;         // invalidated once traded through
   double                 strength;       // 0..1 quality score
  };

//+------------------------------------------------------------------+
//| Horizontal level                                                 |
//+------------------------------------------------------------------+
struct ApexLevel
  {
   ENUM_APEX_LEVEL_TYPE   type;
   double                 price;
   int                    touches;
   datetime               last_touch;
   double                 strength;       // 0..1
  };

//+------------------------------------------------------------------+
//| Trade signal produced by the strategy engine                     |
//+------------------------------------------------------------------+
struct ApexSignal
  {
   bool                   valid;
   ENUM_APEX_STRATEGY     strategy;
   ENUM_APEX_DIRECTION    direction;
   double                 entry;          // 0 => market
   double                 stop_loss;
   double                 take_profit;
   double                 confidence;     // 0..1 confluence score
   string                 reason;         // human-readable entry rationale
   datetime               bar_time;       // signal bar (duplicate prevention)
  };

//+------------------------------------------------------------------+
//| Prop firm rule set                                               |
//+------------------------------------------------------------------+
struct ApexPropRules
  {
   string                 name;
   double                 max_daily_dd_pct;      // e.g. 5.0
   double                 max_overall_dd_pct;    // e.g. 10.0
   bool                   overall_dd_trailing;   // trailing (from HWM) vs static (from initial)
   bool                   daily_dd_from_equity;  // daily anchor: max(balance,equity) vs balance
   double                 profit_target_pct;     // evaluation target, 0 = funded/no target
   int                    min_trading_days;
   double                 max_risk_per_trade_pct;
   double                 consistency_max_day_pct; // max share of profit from one day (0=off)
   double                 soft_daily_dd_buffer_pct;   // EA stops earlier than the firm limit
   double                 soft_overall_dd_buffer_pct;
  };

//+------------------------------------------------------------------+
//| Per-trade record used by statistics + CSV logger                 |
//+------------------------------------------------------------------+
struct ApexTradeRecord
  {
   ulong                  position_id;
   datetime               open_time;
   datetime               close_time;
   string                 symbol;
   ENUM_APEX_DIRECTION    direction;
   double                 entry;
   double                 exit;
   double                 sl;
   double                 tp;
   double                 lots;
   double                 risk_pct;
   double                 risk_money;
   double                 r_multiple;
   double                 profit;         // net incl. commission+swap
   double                 commission;
   double                 swap;
   double                 spread_points;
   double                 slippage_points;
   string                 entry_reason;
   string                 exit_reason;
   string                 regime;
   string                 session;
   bool                   is_win;
  };

//+------------------------------------------------------------------+
//| Helpers for enum -> string (dashboard & logging)                 |
//+------------------------------------------------------------------+
string ApexRegimeToString(const ENUM_APEX_REGIME r)
  {
   switch(r)
     {
      case REGIME_TRENDING:        return "Trending";
      case REGIME_RANGING:         return "Ranging";
      case REGIME_EXPANSION:       return "Expansion";
      case REGIME_COMPRESSION:     return "Compression";
      case REGIME_HIGH_VOLATILITY: return "High Volatility";
      case REGIME_LOW_VOLATILITY:  return "Low Volatility";
      case REGIME_NEWS:            return "News Window";
      default:                     return "Unknown";
     }
  }

string ApexTrendToString(const ENUM_APEX_TREND t)
  {
   switch(t)
     {
      case TREND_BULLISH:       return "Bullish";
      case TREND_BEARISH:       return "Bearish";
      case TREND_BULL_PULLBACK: return "Bull Pullback";
      case TREND_BEAR_PULLBACK: return "Bear Pullback";
      case TREND_CONSOLIDATION: return "Consolidation";
      default:                  return "None";
     }
  }

string ApexStrategyToString(const ENUM_APEX_STRATEGY s)
  {
   switch(s)
     {
      case STRAT_TREND_PULLBACK:    return "Trend Pullback";
      case STRAT_LIQUIDITY_SWEEP:   return "Liquidity Sweep";
      case STRAT_BREAKOUT_RETEST:   return "Breakout Retest";
      case STRAT_FALSE_BREAKOUT:    return "False Breakout Fade";
      case STRAT_COMPRESSION_BREAK: return "Compression Breakout";
      default:                      return "None";
     }
  }

string ApexTradeStateToString(const ENUM_APEX_TRADE_STATE s)
  {
   switch(s)
     {
      case STATE_TRADING:                return "TRADING";
      case STATE_BLOCKED_DAILY_DD:       return "HALT: Daily DD";
      case STATE_BLOCKED_OVERALL_DD:     return "HALT: Overall DD";
      case STATE_BLOCKED_WEEKLY_DD:      return "HALT: Weekly DD";
      case STATE_BLOCKED_NEWS:           return "PAUSED: News";
      case STATE_BLOCKED_SESSION:        return "PAUSED: Session";
      case STATE_BLOCKED_SPREAD:         return "PAUSED: Spread";
      case STATE_BLOCKED_MAX_TRADES:     return "PAUSED: Max Trades";
      case STATE_BLOCKED_CONSEC_LOSS:    return "HALT: Consec. Losses";
      case STATE_BLOCKED_PROFIT_LOCK:    return "DONE: Profit Locked";
      case STATE_BLOCKED_WEEKEND:        return "PAUSED: Weekend";
      case STATE_BLOCKED_HOLIDAY:        return "PAUSED: Holiday";
      case STATE_BLOCKED_REGIME:         return "WAIT: Regime";
      case STATE_BLOCKED_TARGET_REACHED: return "DONE: Target Reached";
      case STATE_BLOCKED_EQUITY_GUARD:   return "HALT: Equity Guard";
      default:                           return "UNKNOWN";
     }
  }
//+------------------------------------------------------------------+
