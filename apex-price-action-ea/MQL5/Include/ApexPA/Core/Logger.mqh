//+------------------------------------------------------------------+
//|                                                       Logger.mqh |
//| Structured error / event logger.                                 |
//|                                                                  |
//| Writes levelled log lines to the Experts journal and mirrors     |
//| them to a per-day log file under MQL5/Files/ApexPA/logs so that  |
//| incidents on a prop-firm VPS can be reconstructed after the fact.|
//+------------------------------------------------------------------+

enum ENUM_APEX_LOG_LEVEL
  {
   LOG_DEBUG = 0,
   LOG_INFO  = 1,
   LOG_WARN  = 2,
   LOG_ERROR = 3
  };

class CLogger
  {
private:
   ENUM_APEX_LOG_LEVEL m_min_level;
   bool              m_to_file;
   string            m_dir;
   string            m_tag;

   string            LevelName(const ENUM_APEX_LOG_LEVEL lvl) const
     {
      switch(lvl)
        {
         case LOG_DEBUG: return "DEBUG";
         case LOG_INFO:  return "INFO ";
         case LOG_WARN:  return "WARN ";
         default:        return "ERROR";
        }
     }

   void              WriteFile(const string line)
     {
      if(!m_to_file) return;
      string fname = m_dir + "\\log_" + TimeToString(TimeCurrent(), TIME_DATE) + ".txt";
      StringReplace(fname, ".", "-");           // TimeToString uses yyyy.mm.dd
      StringReplace(fname, "-txt", ".txt");
      int h = FileOpen(fname, FILE_READ | FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_SHARE_READ);
      if(h == INVALID_HANDLE) return;
      FileSeek(h, 0, SEEK_END);
      FileWriteString(h, line + "\r\n");
      FileClose(h);
     }

public:
                     CLogger() : m_min_level(LOG_INFO), m_to_file(true), m_dir("ApexPA\\logs"), m_tag("ApexPA") {}

   void              Init(const string tag, const ENUM_APEX_LOG_LEVEL min_level, const bool to_file)
     {
      m_tag = tag;
      m_min_level = min_level;
      m_to_file = to_file;
      if(m_to_file)
         FolderCreate("ApexPA\\logs");
     }

   void              Log(const ENUM_APEX_LOG_LEVEL lvl, const string msg)
     {
      if(lvl < m_min_level) return;
      string line = StringFormat("%s [%s] %s: %s",
                                 TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS),
                                 LevelName(lvl), m_tag, msg);
      Print(line);
      WriteFile(line);
     }

   void              Debug(const string msg) { Log(LOG_DEBUG, msg); }
   void              Info(const string msg)  { Log(LOG_INFO, msg);  }
   void              Warn(const string msg)  { Log(LOG_WARN, msg);  }
   void              Error(const string msg) { Log(LOG_ERROR, msg + StringFormat(" (last_error=%d)", GetLastError())); }
  };

// Single shared logger instance for the whole EA.
CLogger ApexLog;
//+------------------------------------------------------------------+
