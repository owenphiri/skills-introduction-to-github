//+------------------------------------------------------------------+
//|                                                   NewsFilter.mqh |
//| High-impact news protection.                                     |
//|                                                                  |
//| Primary source: the MT5 built-in economic calendar (works on     |
//| live/demo terminals with calendar access).                       |
//| Fallback: fixed daily blackout windows (e.g. around typical      |
//| US data releases) for strategy-tester runs where the calendar    |
//| is unavailable. Many prop firms restrict holding positions       |
//| through red-folder news on funded accounts - keep this ON.       |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Logger.mqh>

class CNewsFilter
  {
private:
   bool              m_enabled;
   int               m_before_min;
   int               m_after_min;
   string            m_symbol;
   bool              m_calendar_ok;
   datetime          m_next_event;
   string            m_next_event_name;
   datetime          m_last_poll;

   //--- currencies relevant to this symbol
   void              RelevantCurrencies(string &ccys[]) const
     {
      ArrayResize(ccys, 0);
      if(StringLen(m_symbol) >= 6)
        {
         string a = StringSubstr(m_symbol, 0, 3);
         string b = StringSubstr(m_symbol, 3, 3);
         ArrayResize(ccys, 2);
         ccys[0] = a;
         ccys[1] = b;
        }
      else
        {
         // indices/metals/crypto: USD news dominates
         ArrayResize(ccys, 1);
         ccys[0] = "USD";
        }
     }

   void              PollCalendar()
     {
      if(TimeCurrent() - m_last_poll < 300) return; // poll every 5 min
      m_last_poll = TimeCurrent();
      m_next_event = 0;
      m_next_event_name = "";

      MqlCalendarValue values[];
      datetime from = TimeCurrent() - m_after_min * 60;
      datetime to   = TimeCurrent() + 24 * 3600;
      if(CalendarValueHistory(values, from, to) <= 0)
        {
         m_calendar_ok = false;
         return;
        }
      m_calendar_ok = true;

      string ccys[];
      RelevantCurrencies(ccys);

      for(int i = 0; i < ArraySize(values); i++)
        {
         MqlCalendarEvent ev;
         if(!CalendarEventById(values[i].event_id, ev)) continue;
         if(ev.importance != CALENDAR_IMPORTANCE_HIGH) continue;
         MqlCalendarCountry country;
         if(!CalendarCountryById(ev.country_id, country)) continue;
         bool relevant = false;
         for(int c = 0; c < ArraySize(ccys); c++)
            if(country.currency == ccys[c]) { relevant = true; break; }
         if(!relevant) continue;
         if(m_next_event == 0 || values[i].time < m_next_event)
           {
            m_next_event      = values[i].time;
            m_next_event_name = country.currency + " " + ev.name;
           }
        }
     }

public:
                     CNewsFilter() : m_enabled(false), m_before_min(15), m_after_min(15),
                                     m_symbol(""), m_calendar_ok(false), m_next_event(0),
                                     m_next_event_name(""), m_last_poll(0) {}

   void              Init(const string symbol, const bool enabled,
                          const int before_min, const int after_min)
     {
      m_symbol     = symbol;
      m_enabled    = enabled;
      m_before_min = before_min;
      m_after_min  = after_min;
     }

   //--- true while inside a news blackout window
   bool              InNewsWindow()
     {
      if(!m_enabled) return false;
      PollCalendar();

      if(m_calendar_ok)
        {
         if(m_next_event == 0) return false;
         datetime now = TimeCurrent();
         return (now >= m_next_event - m_before_min * 60 &&
                 now <= m_next_event + m_after_min * 60);
        }

      // Fallback (tester / no calendar): block the classic red-news slots
      // 12:30 & 14:00 UTC (US data / FOMC-style times), Mon-Fri.
      MqlDateTime dt;
      TimeToStruct(TimeGMT(), dt);
      if(dt.day_of_week >= 1 && dt.day_of_week <= 5)
        {
         int mins = dt.hour * 60 + dt.min;
         int slots[2] = { 12 * 60 + 30, 14 * 60 };
         for(int i = 0; i < 2; i++)
            if(mins >= slots[i] - m_before_min && mins <= slots[i] + m_after_min)
               return true;
        }
      return false;
     }

   string            Status()
     {
      if(!m_enabled) return "News filter OFF";
      if(InNewsWindow()) return "IN NEWS WINDOW" +
         (m_next_event_name != "" ? (": " + m_next_event_name) : "");
      if(m_next_event > 0)
         return "Next: " + m_next_event_name + " @ " +
                TimeToString(m_next_event, TIME_DATE | TIME_MINUTES);
      return "Clear";
     }
  };
//+------------------------------------------------------------------+
