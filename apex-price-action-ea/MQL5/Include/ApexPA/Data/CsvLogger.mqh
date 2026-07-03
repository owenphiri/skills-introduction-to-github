//+------------------------------------------------------------------+
//|                                                    CsvLogger.mqh |
//| CSV export of every trade and periodic performance reports.      |
//|                                                                  |
//| Files land in MQL5/Files/ApexPA/ (or the tester's Files dir):    |
//|  - trades_<symbol>.csv     one row per closed trade              |
//|  - events_<symbol>.csv     entries/exits/blocks/errors           |
//|  - report_daily.csv        appended once per day                 |
//|  - report_weekly.csv       appended once per week                |
//|  - report_monthly.csv      appended once per month               |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Analytics/Statistics.mqh>

class CCsvLogger
  {
private:
   string            m_dir;
   string            m_symbol;
   bool              m_enabled;
   datetime          m_last_daily, m_last_weekly, m_last_monthly;

   int               OpenAppend(const string fname, const string header)
     {
      string path = m_dir + "\\" + fname;
      bool existed = FileIsExist(path);
      int h = FileOpen(path, FILE_READ | FILE_WRITE | FILE_CSV | FILE_ANSI | FILE_SHARE_READ, ';');
      if(h == INVALID_HANDLE) return INVALID_HANDLE;
      FileSeek(h, 0, SEEK_END);
      if(!existed || FileTell(h) == 0)
         FileWriteString(h, header + "\r\n");
      return h;
     }

   string            Sanitize(string s) const
     {
      StringReplace(s, ";", ",");
      StringReplace(s, "\n", " ");
      StringReplace(s, "\r", " ");
      return s;
     }

public:
                     CCsvLogger() : m_dir("ApexPA"), m_symbol(""), m_enabled(true),
                                    m_last_daily(0), m_last_weekly(0), m_last_monthly(0) {}

   void              Init(const string symbol, const bool enabled)
     {
      m_symbol  = symbol;
      m_enabled = enabled;
      if(m_enabled)
         FolderCreate(m_dir);
     }

   void              LogTrade(const ApexTradeRecord &r)
     {
      if(!m_enabled) return;
      int h = OpenAppend("trades_" + m_symbol + ".csv",
         "close_time;open_time;symbol;direction;entry;exit;sl;tp;lots;risk_pct;risk_money;"
         "r_multiple;profit;commission;swap;spread_points;slippage_points;win;"
         "entry_reason;exit_reason;regime;session;duration_min");
      if(h == INVALID_HANDLE) return;
      FileWriteString(h, StringFormat("%s;%s;%s;%s;%.5f;%.5f;%.5f;%.5f;%.2f;%.2f;%.2f;%.2f;%.2f;%.2f;%.2f;%.1f;%.1f;%d;%s;%s;%s;%s;%.1f\r\n",
         TimeToString(r.close_time, TIME_DATE | TIME_SECONDS),
         TimeToString(r.open_time, TIME_DATE | TIME_SECONDS),
         r.symbol,
         r.direction == DIR_LONG ? "LONG" : "SHORT",
         r.entry, r.exit, r.sl, r.tp, r.lots, r.risk_pct, r.risk_money,
         r.r_multiple, r.profit, r.commission, r.swap,
         r.spread_points, r.slippage_points,
         r.is_win ? 1 : 0,
         Sanitize(r.entry_reason), Sanitize(r.exit_reason),
         Sanitize(r.regime), Sanitize(r.session),
         (double)(r.close_time - r.open_time) / 60.0));
      FileClose(h);
     }

   void              LogEvent(const string type, const string detail)
     {
      if(!m_enabled) return;
      int h = OpenAppend("events_" + m_symbol + ".csv", "time;type;detail");
      if(h == INVALID_HANDLE) return;
      FileWriteString(h, StringFormat("%s;%s;%s\r\n",
         TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS),
         Sanitize(type), Sanitize(detail)));
      FileClose(h);
     }

   //--- periodic report rows; call from OnTimer
   void              MaybeWriteReports(CStatistics *stats)
     {
      if(!m_enabled || stats == NULL) return;
      datetime now = TimeCurrent();
      datetime day = now - (now % 86400);

      MqlDateTime dt;
      TimeToStruct(now, dt);
      datetime week  = day - (dt.day_of_week == 0 ? 6 : dt.day_of_week - 1) * 86400;
      datetime month = day - (dt.day - 1) * 86400;

      if(day != m_last_daily)
        {
         WriteReportRow("report_daily.csv", "day", stats, stats.ProfitSince(day - 86400));
         m_last_daily = day;
        }
      if(week != m_last_weekly)
        {
         WriteReportRow("report_weekly.csv", "week", stats, stats.ProfitSince(week - 7 * 86400));
         m_last_weekly = week;
        }
      if(month != m_last_monthly)
        {
         WriteReportRow("report_monthly.csv", "month", stats, stats.ProfitSince(month - 30 * 86400));
         m_last_monthly = month;
        }
     }

   void              WriteReportRow(const string fname, const string period,
                                    CStatistics *stats, const double period_profit)
     {
      int h = OpenAppend(fname,
         "time;period;balance;equity;period_profit;total_trades;win_rate;profit_factor;"
         "expectancy;avg_r;sharpe;sortino;recovery;max_dd_money");
      if(h == INVALID_HANDLE) return;
      int mw, ml;
      stats.Streaks(mw, ml);
      FileWriteString(h, StringFormat("%s;%s;%.2f;%.2f;%.2f;%d;%.1f;%.2f;%.2f;%.2f;%.2f;%.2f;%.2f;%.2f\r\n",
         TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS), period,
         AccountInfoDouble(ACCOUNT_BALANCE), AccountInfoDouble(ACCOUNT_EQUITY),
         period_profit, stats.Total(), stats.WinRate(), stats.ProfitFactor(),
         stats.Expectancy(), stats.AverageR(), stats.Sharpe(), stats.Sortino(),
         stats.RecoveryFactor(), stats.MaxDDMoney()));
      FileClose(h);
     }
  };
//+------------------------------------------------------------------+
