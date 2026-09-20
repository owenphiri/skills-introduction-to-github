//+------------------------------------------------------------------+
//|                                              ApexPriceAction.mq5 |
//|          ApexPA - Institutional Pure Price Action Expert Advisor |
//|                                                                  |
//| Pure price action trading system for prop-firm evaluations and   |
//| funded accounts. No lagging indicators are used for entries:     |
//| all signals derive from market structure, liquidity, levels,     |
//| zones and candle behaviour. A volatility unit (raw true-range    |
//| average) is used ONLY for risk normalisation and stop placement. |
//|                                                                  |
//| Architecture (see docs/ARCHITECTURE.md):                         |
//|   Core:       SymbolAdapter, Logger, Definitions                 |
//|   PriceAction:Swing, Structure, Candle, Level, Zone, Liquidity,  |
//|               Regime engines                                     |
//|   Analysis:   Multi-timeframe context stack                      |
//|   Risk:       RiskManager, PropFirmManager, NewsFilter           |
//|   Execution:  ExecutionEngine, TradeManager                      |
//|   Strategy:   SignalEngine (regime-gated confluence scoring)     |
//|   Analytics:  Statistics, Dashboard                              |
//|   Data:       CsvLogger                                          |
//+------------------------------------------------------------------+
#property copyright   "ApexPA"
#property version     "1.00"
#property description "Pure price action EA for prop firm challenges and funded accounts."
#property description "Capital preservation first: quality over quantity."

#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Core/SymbolAdapter.mqh>
#include <ApexPA/Core/Logger.mqh>
#include <ApexPA/PriceAction/SwingEngine.mqh>
#include <ApexPA/PriceAction/StructureEngine.mqh>
#include <ApexPA/PriceAction/CandleEngine.mqh>
#include <ApexPA/PriceAction/LevelEngine.mqh>
#include <ApexPA/PriceAction/ZoneEngine.mqh>
#include <ApexPA/PriceAction/LiquidityEngine.mqh>
#include <ApexPA/PriceAction/RegimeEngine.mqh>
#include <ApexPA/Analysis/MTFAnalyzer.mqh>
#include <ApexPA/Risk/PropFirmManager.mqh>
#include <ApexPA/Risk/RiskManager.mqh>
#include <ApexPA/Risk/NewsFilter.mqh>
#include <ApexPA/Execution/ExecutionEngine.mqh>
#include <ApexPA/Execution/TradeManager.mqh>
#include <ApexPA/Strategy/SignalEngine.mqh>
#include <ApexPA/Analytics/Statistics.mqh>
#include <ApexPA/Analytics/Dashboard.mqh>
#include <ApexPA/Data/CsvLogger.mqh>

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+
input group "=== General ==="
input long              InpMagic                = 86452301;      // Magic number
input ENUM_TIMEFRAMES   InpExecutionTF          = PERIOD_M15;    // Execution timeframe
input bool              InpShowDashboard        = true;          // Show analytics dashboard
input bool              InpCsvLogging           = true;          // Export trades/events to CSV
input bool              InpVerboseLog           = false;         // Debug-level journal logging

input group "=== Prop Firm ==="
input ENUM_APEX_PROP_FIRM InpPropFirm           = PROP_FTMO;     // Prop firm preset
input double            InpInitialBalance       = 0;             // Challenge start balance (0 = current)
// Custom firm overrides (used when preset = PROP_CUSTOM; -1 = keep preset value)
input double            InpCustomDailyDD        = -1;            // Custom: max daily DD %
input double            InpCustomOverallDD      = -1;            // Custom: max overall DD %
input bool              InpCustomTrailingDD     = false;         // Custom: overall DD trails HWM
input double            InpCustomTargetPct      = -1;            // Custom: profit target %
input int               InpCustomMinDays        = -1;            // Custom: min trading days
input double            InpCustomConsistencyPct = -1;            // Custom: max single-day profit share % (0=off)
input double            InpSoftDailyBuffer      = 0.8;           // Safety buffer before daily limit %
input double            InpSoftOverallBuffer    = 1.5;           // Safety buffer before overall limit %

input group "=== Risk ==="
input double            InpRiskPerTradePct      = 0.5;           // Risk per trade % (0.25/0.5/0.75/1.0)
input double            InpMaxWeeklyDDPct       = 0;             // Max weekly DD % (0 = off)
input int               InpMaxOpenTrades        = 2;             // Max simultaneous positions
input int               InpMaxTradesPerDay      = 3;             // Max new trades per day
input int               InpMaxConsecLosses      = 3;             // Cool-down after N consecutive losses
input int               InpCooldownHours        = 12;            // Cool-down duration (hours)
input double            InpDailyProfitLockPct   = 2.0;           // Stop for the day after +X% (0 = off)
input double            InpEquityGuardPct       = 3.0;           // Flatten all at floating DD % (0 = off)
input bool              InpCorrelationFilter    = true;          // Block correlated same-direction exposure
input double            InpMaxTotalRiskPct      = 1.5;           // Cap on summed open risk %
input bool              InpReduceRiskInDD       = true;          // Halve risk while in drawdown

input group "=== Protection ==="
input bool              InpNewsFilter           = true;          // Block entries around high-impact news
input int               InpNewsBeforeMin        = 15;            // Minutes blocked before news
input int               InpNewsAfterMin         = 15;            // Minutes blocked after news
input bool              InpBlockWeekend         = true;          // No entries near/at weekend
input int               InpFridayCloseHour      = 20;            // No entries after this hour Friday (broker time, 0=off)
input bool              InpCloseBeforeWeekend   = false;         // Flatten positions before weekend
input double            InpMaxSpreadPoints      = 0;             // Max spread in points (0 = auto: 3x median)
input int               InpMaxSlippagePoints    = 30;            // Max slippage (deviation) points

input group "=== Sessions (broker time) ==="
input bool              InpUseSessionFilter     = true;          // Restrict entries to sessions
input int               InpSession1Start        = 7;             // Session 1 start hour
input int               InpSession1End          = 12;            // Session 1 end hour
input int               InpSession2Start        = 13;            // Session 2 start hour
input int               InpSession2End          = 20;            // Session 2 end hour

input group "=== Strategies ==="
input bool              InpEnableTrendPullback  = true;          // A: Trend pullback
input bool              InpEnableLiquiditySweep = true;          // B: Liquidity sweep reversal
input bool              InpEnableBreakoutRetest = true;          // C: Breakout + retest
input bool              InpEnableFalseBreakout  = true;          // D: False breakout fade
input bool              InpEnableCompression    = true;          // E: Compression breakout
input double            InpMinConfluence        = 0.62;          // Min confluence score (0..1)
input double            InpMinRR                = 1.5;           // Min reward:risk
input double            InpHTFConviction        = 0.30;          // Min MTF bias conviction (0..1)

input group "=== Price Action Engine ==="
input int               InpSwingStrength        = 3;             // Swing/fractal strength (bars each side)
input int               InpSwingLookback        = 400;           // Swing scan depth (bars)
input bool              InpUseOrderBlocks       = true;          // Order block module
input bool              InpUseFVG               = true;          // Fair value gap module
input double            InpImpulseFactor        = 1.2;           // Zone impulse threshold (x vol unit)
input double            InpSLBufferVol          = 0.35;          // SL buffer (x vol unit)
input double            InpMaxSLVol             = 3.0;           // Reject SL wider than (x vol unit)

input group "=== Trade Management ==="
input bool              InpUseBreakEven         = true;          // Auto break-even
input double            InpBETriggerR           = 1.0;           // BE trigger (+R)
input double            InpBEOffsetR            = 0.1;           // BE lock-in (+R)
input bool              InpUsePartial           = true;          // Partial profit taking
input double            InpPartialTriggerR      = 1.5;           // Partial trigger (+R)
input double            InpPartialClosePct      = 50;            // Partial close %
input bool              InpUseTrailing          = true;          // Smart trailing stop
input double            InpTrailStartR          = 2.0;           // Trailing start (+R)
input double            InpTrailATRMult         = 1.5;           // Trailing distance (x vol unit)
input bool              InpTrailStructure       = true;          // Trail behind structure swings

//+------------------------------------------------------------------+
//| Module instances                                                 |
//+------------------------------------------------------------------+
CSymbolAdapter    g_adapter;
CSwingEngine      g_swings;          // execution timeframe
CStructureEngine  g_structure;
CCandleEngine     g_candles;
CLevelEngine      g_levels;
CZoneEngine       g_zones;
CLiquidityEngine  g_liquidity;
CRegimeEngine     g_regime;
CMTFAnalyzer      g_mtf;
CPropFirmManager  g_prop;
CRiskManager      g_risk;
CNewsFilter       g_news;
CExecutionEngine  g_exec;
CTradeManager     g_manager;
CSignalEngine     g_signals;
CStatistics       g_stats;
CDashboard        g_dash;
CCsvLogger        g_csv;

//--- open-position metadata (keyed by position id) for rich trade records
struct SOpenMeta
  {
   ulong             position_id;
   string            entry_reason;
   string            regime;
   string            session;
   double            risk_pct;
   double            risk_money;
   double            spread_points;
   double            slippage_points;
   double            initial_sl;
  };
SOpenMeta         g_open_meta[];
string            g_last_strategy = "None";
double            g_median_spread = 0;
int               g_spread_samples = 0;

//+------------------------------------------------------------------+
//| Session helpers                                                  |
//+------------------------------------------------------------------+
bool InSession()
  {
   if(!InpUseSessionFilter) return true;
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   bool s1 = (dt.hour >= InpSession1Start && dt.hour < InpSession1End);
   bool s2 = (dt.hour >= InpSession2Start && dt.hour < InpSession2End);
   return s1 || s2;
  }

string SessionName()
  {
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   if(dt.hour >= 0 && dt.hour < 7)   return "Asia";
   if(dt.hour >= 7 && dt.hour < 12)  return "London";
   if(dt.hour >= 12 && dt.hour < 16) return "London/NY";
   if(dt.hour >= 16 && dt.hour < 21) return "New York";
   return "Late NY";
  }

//+------------------------------------------------------------------+
//| Open-metadata registry                                           |
//+------------------------------------------------------------------+
void RegisterOpenMeta(const SOpenMeta &meta)
  {
   int n = ArraySize(g_open_meta);
   ArrayResize(g_open_meta, n + 1);
   g_open_meta[n] = meta;
  }

bool PopOpenMeta(const ulong position_id, SOpenMeta &out)
  {
   for(int i = 0; i < ArraySize(g_open_meta); i++)
      if(g_open_meta[i].position_id == position_id)
        {
         out = g_open_meta[i];
         for(int j = i; j < ArraySize(g_open_meta) - 1; j++)
            g_open_meta[j] = g_open_meta[j + 1];
         ArrayResize(g_open_meta, ArraySize(g_open_meta) - 1);
         return true;
        }
   return false;
  }

//+------------------------------------------------------------------+
//| Expert initialization                                            |
//+------------------------------------------------------------------+
int OnInit()
  {
   ApexLog.Init("ApexPA", InpVerboseLog ? LOG_DEBUG : LOG_INFO, true);
   ApexLog.Info("=== ApexPA v" + APEX_VERSION + " starting on " + _Symbol + " ===");

   if(!g_adapter.Init(_Symbol, InpExecutionTF))
     {
      ApexLog.Error("Symbol adapter failed to initialise for " + _Symbol);
      return INIT_FAILED;
     }
   ApexLog.Info(StringFormat("Instrument: %s (%s), pip=%g, tick_value=%g",
                _Symbol, g_adapter.AssetClassName(), g_adapter.Pip(),
                SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE)));

   // price action stack on the execution timeframe
   g_swings.Init(_Symbol, InpExecutionTF, InpSwingStrength, InpSwingLookback);
   g_structure.Init(_Symbol, InpExecutionTF, &g_swings);
   g_candles.Init(_Symbol, InpExecutionTF);
   g_levels.Init(_Symbol, InpExecutionTF, &g_adapter, &g_swings);
   g_zones.Init(_Symbol, InpExecutionTF, &g_adapter, InpUseOrderBlocks, InpUseFVG, InpImpulseFactor);
   g_liquidity.Init(_Symbol, InpExecutionTF, &g_adapter, &g_swings);
   g_regime.Init(_Symbol, InpExecutionTF);

   // multi-timeframe context (context TFs above the execution TF)
   ENUM_TIMEFRAMES ctx[];
   ArrayResize(ctx, 4);
   if(InpExecutionTF <= PERIOD_M5)
     { ctx[0] = PERIOD_D1; ctx[1] = PERIOD_H4; ctx[2] = PERIOD_H1; ctx[3] = PERIOD_M15; }
   else if(InpExecutionTF <= PERIOD_M30)
     { ctx[0] = PERIOD_W1; ctx[1] = PERIOD_D1; ctx[2] = PERIOD_H4; ctx[3] = PERIOD_H1; }
   else
     { ctx[0] = PERIOD_MN1; ctx[1] = PERIOD_W1; ctx[2] = PERIOD_D1; ctx[3] = PERIOD_H4; }
   g_mtf.Init(_Symbol, ctx, InpSwingStrength, 300);

   // prop firm + risk
   g_prop.Init(InpPropFirm, InpInitialBalance);
   if(InpPropFirm == PROP_CUSTOM)
      g_prop.ApplyCustom(InpCustomDailyDD, InpCustomOverallDD, InpCustomTrailingDD,
                         InpCustomTargetPct, InpCustomMinDays, InpCustomConsistencyPct,
                         InpSoftDailyBuffer, InpSoftOverallBuffer);
   else
      g_prop.ApplyCustom(-1, -1, g_prop.Rules().overall_dd_trailing, -1, -1, -1,
                         InpSoftDailyBuffer, InpSoftOverallBuffer);

   ApexRiskConfig rc;
   rc.risk_per_trade_pct           = InpRiskPerTradePct;
   rc.max_weekly_dd_pct            = InpMaxWeeklyDDPct;
   rc.max_open_trades              = InpMaxOpenTrades;
   rc.max_trades_per_day           = InpMaxTradesPerDay;
   rc.max_consecutive_losses       = InpMaxConsecLosses;
   rc.cooldown_hours               = InpCooldownHours;
   rc.daily_profit_lock_pct        = InpDailyProfitLockPct;
   rc.equity_guard_floating_dd_pct = InpEquityGuardPct;
   rc.use_correlation_filter       = InpCorrelationFilter;
   rc.max_total_risk_pct           = InpMaxTotalRiskPct;
   rc.block_weekend                = InpBlockWeekend;
   rc.friday_close_hour            = InpFridayCloseHour;
   rc.news_filter                  = InpNewsFilter;
   rc.news_block_before_min        = InpNewsBeforeMin;
   rc.news_block_after_min         = InpNewsAfterMin;
   rc.reduce_risk_in_dd            = InpReduceRiskInDD;
   g_risk.Init(rc, &g_adapter, &g_prop, InpMagic);

   g_news.Init(_Symbol, InpNewsFilter, InpNewsBeforeMin, InpNewsAfterMin);

   // execution + management
   g_exec.Init(&g_adapter, InpMagic, InpMaxSpreadPoints, InpMaxSlippagePoints);
   ApexManageConfig mc;
   mc.use_break_even     = InpUseBreakEven;
   mc.be_trigger_r       = InpBETriggerR;
   mc.be_offset_r        = InpBEOffsetR;
   mc.use_partial        = InpUsePartial;
   mc.partial_trigger_r  = InpPartialTriggerR;
   mc.partial_close_pct  = InpPartialClosePct;
   mc.use_trailing       = InpUseTrailing;
   mc.trail_start_r      = InpTrailStartR;
   mc.trail_atr_mult     = InpTrailATRMult;
   mc.trail_use_structure= InpTrailStructure;
   g_manager.Init(mc, &g_adapter, &g_exec, &g_swings);

   // strategy engine
   ApexStrategyConfig sc;
   sc.enable_trend_pullback   = InpEnableTrendPullback;
   sc.enable_liquidity_sweep  = InpEnableLiquiditySweep;
   sc.enable_breakout_retest  = InpEnableBreakoutRetest;
   sc.enable_false_breakout   = InpEnableFalseBreakout;
   sc.enable_compression_break= InpEnableCompression;
   sc.min_confluence          = InpMinConfluence;
   sc.min_rr                  = InpMinRR;
   sc.sl_buffer_vol           = InpSLBufferVol;
   sc.max_sl_vol              = InpMaxSLVol;
   sc.htf_min_conviction      = InpHTFConviction;
   g_signals.Init(_Symbol, InpExecutionTF, sc, &g_adapter, &g_swings, &g_structure,
                  &g_candles, &g_levels, &g_zones, &g_liquidity, &g_regime, &g_mtf);

   // analytics
   g_stats.Init(g_prop.InitialBalance());
   g_dash.Init(InpShowDashboard && !MQLInfoInteger(MQL_OPTIMIZATION));
   g_csv.Init(_Symbol, InpCsvLogging && !MQLInfoInteger(MQL_OPTIMIZATION));

   EventSetTimer(1);
   g_csv.LogEvent("INIT", "ApexPA started, preset=" + g_prop.FirmName());
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
//| Expert deinitialization                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   g_dash.Destroy();
   g_csv.LogEvent("DEINIT", StringFormat("reason=%d", reason));
   ApexLog.Info("ApexPA stopped.");
  }

//+------------------------------------------------------------------+
//| Main tick handler                                                |
//+------------------------------------------------------------------+
void OnTick()
  {
   // 1) refresh price action state (bar-gated internally)
   g_structure.Update();      // also updates g_swings
   g_levels.Update();
   g_zones.Update();
   g_liquidity.Update();
   g_regime.Update();
   g_mtf.Update();
   g_stats.OnEquityTick();

   // spread median tracker for the auto spread cap
   double sp = g_adapter.SpreadPoints();
   g_median_spread = (g_spread_samples == 0) ? sp
                     : g_median_spread + (sp - g_median_spread) * 0.01;
   g_spread_samples++;

   // 2) equity guard: flatten if floating drawdown is extreme
   if(g_risk.EquityGuardTriggered())
     {
      ApexLog.Warn("EQUITY GUARD triggered - flattening all positions");
      g_csv.LogEvent("EQUITY_GUARD", "Floating DD limit hit - closing all");
      g_exec.CloseAll("equity guard");
      return;
     }

   // 3) hard prop breach protection: never let a floating loss breach limits
   if(g_prop.DailyLimitBreached() || g_prop.OverallLimitBreached())
     {
      if(g_risk.OpenTradesCount() > 0)
        {
         ApexLog.Warn("Soft DD limit reached - flattening to protect the account");
         g_csv.LogEvent("DD_PROTECT", "Soft drawdown limit hit - closing all");
         g_exec.CloseAll("dd protection");
        }
      return;
     }

   // 4) weekend flatten (optional)
   if(InpCloseBeforeWeekend && InpBlockWeekend)
     {
      MqlDateTime dt;
      TimeToStruct(TimeCurrent(), dt);
      if(dt.day_of_week == 5 && InpFridayCloseHour > 0 && dt.hour >= InpFridayCloseHour &&
         g_risk.OpenTradesCount() > 0)
        {
         g_csv.LogEvent("WEEKEND_CLOSE", "Flattening before weekend");
         g_exec.CloseAll("weekend");
        }
     }

   // 5) manage open positions (BE / partial / trailing)
   g_manager.Manage();

   // 6) evaluate entries only once per closed execution-TF bar
   static datetime last_eval_bar = 0;
   datetime bar = iTime(_Symbol, InpExecutionTF, 0);
   if(bar == last_eval_bar) return;
   last_eval_bar = bar;

   // 7) entry gates
   if(!InSession()) return;
   if(g_news.InNewsWindow())
     {
      g_csv.LogEvent("BLOCK", "news window");
      return;
     }
   // spread gate (auto mode: 3x running median)
   double spread_cap = (InpMaxSpreadPoints > 0) ? InpMaxSpreadPoints : g_median_spread * 3.0;
   if(spread_cap > 0 && sp > spread_cap) return;

   ApexSignal sig;
   if(!g_signals.Evaluate(sig)) return;

   ENUM_APEX_TRADE_STATE state = g_risk.CanTrade(_Symbol, sig.direction);
   if(state != STATE_TRADING)
     {
      g_csv.LogEvent("BLOCK", ApexTradeStateToString(state) + " | signal " +
                     ApexStrategyToString(sig.strategy));
      return;
     }

   // 8) size and execute
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick)) return;
   double entry_px = (sig.direction == DIR_LONG) ? tick.ask : tick.bid;

   string note;
   double lots = g_risk.ComputeLots(entry_px, sig.stop_loss, note);
   if(lots <= 0)
     {
      g_csv.LogEvent("SKIP", "size=0 " + note);
      return;
     }

   ulong order = g_exec.OpenMarket(sig.direction, lots, sig.stop_loss, sig.take_profit,
                                   ApexStrategyToString(sig.strategy), sig.bar_time);
   if(order != 0)
     {
      g_risk.OnTradeOpened();
      g_last_strategy = ApexStrategyToString(sig.strategy);

      SOpenMeta meta;
      meta.position_id     = order;   // for market orders order == position id on netting;
                                      // on hedging the position id equals the order id too
      meta.entry_reason    = ApexStrategyToString(sig.strategy) + ": " + sig.reason + " | " + note;
      meta.regime          = ApexRegimeToString(g_regime.Regime());
      meta.session         = SessionName();
      meta.risk_pct        = g_risk.EffectiveRiskPct(entry_px, sig.stop_loss, lots);
      meta.risk_money      = g_adapter.MoneyAtRisk(lots, MathAbs(entry_px - sig.stop_loss));
      meta.spread_points   = sp;
      meta.slippage_points = g_exec.LastSlippagePoints();
      meta.initial_sl      = sig.stop_loss;
      RegisterOpenMeta(meta);

      g_csv.LogEvent("ENTRY", meta.entry_reason +
                     StringFormat(" | lots=%.2f conf=%.2f", lots, sig.confidence));
     }
  }

//+------------------------------------------------------------------+
//| Trade transaction: capture closed positions                      |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   if(!HistoryDealSelect(trans.deal)) return;

   long magic = HistoryDealGetInteger(trans.deal, DEAL_MAGIC);
   if(magic != InpMagic) return;
   long entry_type = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   if(entry_type != DEAL_ENTRY_OUT && entry_type != DEAL_ENTRY_INOUT) return;

   // a position (or part of it) closed
   ulong  pos_id   = HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
   double profit   = HistoryDealGetDouble(trans.deal, DEAL_PROFIT);
   double comm     = HistoryDealGetDouble(trans.deal, DEAL_COMMISSION);
   double swap     = HistoryDealGetDouble(trans.deal, DEAL_SWAP);
   double exit_px  = HistoryDealGetDouble(trans.deal, DEAL_PRICE);
   double lots     = HistoryDealGetDouble(trans.deal, DEAL_VOLUME);
   datetime ctime  = (datetime)HistoryDealGetInteger(trans.deal, DEAL_TIME);
   string  reason_s;
   long dreason = HistoryDealGetInteger(trans.deal, DEAL_REASON);
   switch((ENUM_DEAL_REASON)dreason)
     {
      case DEAL_REASON_SL:     reason_s = "stop loss";   break;
      case DEAL_REASON_TP:     reason_s = "take profit"; break;
      case DEAL_REASON_EXPERT: reason_s = "ea exit";     break;
      default:                 reason_s = "other";       break;
     }

   // if the position still exists (partial close), don't finalise the record
   bool still_open = false;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(tk != 0 && PositionGetInteger(POSITION_IDENTIFIER) == (long)pos_id)
        { still_open = true; break; }
     }

   double net = profit + comm + swap;

   if(still_open)
     {
      g_csv.LogEvent("PARTIAL_CLOSE",
                     StringFormat("pos=%I64u lots=%.2f net=%.2f (%s)", pos_id, lots, net, reason_s));
      return;
     }

   // finalise: reconstruct the full position from history
   SOpenMeta meta;
   bool have_meta = PopOpenMeta(pos_id, meta);

   double total_net = net, entry_px = 0, sl = 0, tp = 0, total_lots = 0;
   datetime otime = ctime;
   ENUM_APEX_DIRECTION dir = DIR_NONE;
   if(HistorySelectByPosition((long)pos_id))
     {
      total_net = 0;
      int deals = HistoryDealsTotal();
      for(int i = 0; i < deals; i++)
        {
         ulong d = HistoryDealGetTicket(i);
         if(d == 0) continue;
         total_net += HistoryDealGetDouble(d, DEAL_PROFIT) +
                      HistoryDealGetDouble(d, DEAL_COMMISSION) +
                      HistoryDealGetDouble(d, DEAL_SWAP);
         if(HistoryDealGetInteger(d, DEAL_ENTRY) == DEAL_ENTRY_IN)
           {
            entry_px   = HistoryDealGetDouble(d, DEAL_PRICE);
            otime      = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
            total_lots += HistoryDealGetDouble(d, DEAL_VOLUME);
            dir = (HistoryDealGetInteger(d, DEAL_TYPE) == DEAL_TYPE_BUY) ? DIR_LONG : DIR_SHORT;
           }
        }
     }
   sl = have_meta ? meta.initial_sl : 0;

   ApexTradeRecord rec;
   rec.position_id  = pos_id;
   rec.open_time    = otime;
   rec.close_time   = ctime;
   rec.symbol       = _Symbol;
   rec.direction    = dir;
   rec.entry        = entry_px;
   rec.exit         = exit_px;
   rec.sl           = sl;
   rec.tp           = tp;
   rec.lots         = total_lots;
   rec.risk_pct     = have_meta ? meta.risk_pct : 0;
   rec.risk_money   = have_meta ? meta.risk_money : 0;
   rec.r_multiple   = (rec.risk_money > 0) ? total_net / rec.risk_money : 0;
   rec.profit       = total_net;
   rec.commission   = comm;
   rec.swap         = swap;
   rec.spread_points   = have_meta ? meta.spread_points : 0;
   rec.slippage_points = have_meta ? meta.slippage_points : 0;
   rec.entry_reason = have_meta ? meta.entry_reason : "n/a (restarted)";
   rec.exit_reason  = reason_s;
   rec.regime       = have_meta ? meta.regime : "n/a";
   rec.session      = have_meta ? meta.session : "n/a";
   rec.is_win       = total_net >= 0;

   g_stats.AddTrade(rec);
   g_risk.OnTradeClosed(total_net);
   g_csv.LogTrade(rec);
   g_manager.GarbageCollect();

   ApexLog.Info(StringFormat("Trade closed: %s %s net=%.2f (%.2fR) exit=%s",
                rec.direction == DIR_LONG ? "LONG" : "SHORT", _Symbol,
                total_net, rec.r_multiple, reason_s));
  }

//+------------------------------------------------------------------+
//| Timer: dashboard + periodic reports                              |
//+------------------------------------------------------------------+
void OnTimer()
  {
   g_dash.Update(&g_stats, &g_risk, &g_prop,
                 ApexRegimeToString(g_regime.Regime()),
                 ApexTrendToString(g_structure.Trend()),
                 g_mtf.BiasText(),
                 g_last_strategy,
                 g_news.Status(),
                 g_adapter.SpreadPoints(),
                 g_exec.LastLatencyMs(),
                 g_risk.State());
   g_csv.MaybeWriteReports(&g_stats);
  }

//+------------------------------------------------------------------+
//| Tester criterion: expectancy * sqrt(trades) penalised by DD      |
//| Encourages robust, low-drawdown parameter sets during            |
//| optimisation instead of raw profit (curve-fit resistant-ish).    |
//+------------------------------------------------------------------+
double OnTester()
  {
   double trades = TesterStatistics(STAT_TRADES);
   if(trades < 20) return 0; // insufficient sample - reject
   double pf   = TesterStatistics(STAT_PROFIT_FACTOR);
   double dd   = TesterStatistics(STAT_EQUITY_DDREL_PERCENT);
   double net  = TesterStatistics(STAT_PROFIT);
   if(net <= 0) return 0;
   double expectancy = net / trades;
   double dd_penalty = 1.0 / (1.0 + dd / 5.0);   // 5% DD halves the score
   return expectancy * MathSqrt(trades) * MathMin(pf, 3.0) * dd_penalty;
  }
//+------------------------------------------------------------------+
