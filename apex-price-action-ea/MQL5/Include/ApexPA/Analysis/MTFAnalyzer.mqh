//+------------------------------------------------------------------+
//|                                                  MTFAnalyzer.mqh |
//| Multi-timeframe context stack.                                   |
//|                                                                  |
//| Maintains an independent swing + structure engine per timeframe  |
//| (MN1..M1 configurable). Higher timeframes provide directional    |
//| bias and key levels; the execution timeframe provides entries.   |
//| Bias is a weighted vote: the higher the timeframe, the larger    |
//| its weight.                                                      |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/PriceAction/SwingEngine.mqh>
#include <ApexPA/PriceAction/StructureEngine.mqh>

#define APEX_MTF_MAX 9

class CMTFAnalyzer
  {
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_tfs[APEX_MTF_MAX];
   double            m_weights[APEX_MTF_MAX];
   int               m_count;
   CSwingEngine      m_swings[APEX_MTF_MAX];
   CStructureEngine  m_structs[APEX_MTF_MAX];

   double            TFWeight(const ENUM_TIMEFRAMES tf) const
     {
      switch(tf)
        {
         case PERIOD_MN1: return 8.0;
         case PERIOD_W1:  return 6.0;
         case PERIOD_D1:  return 5.0;
         case PERIOD_H4:  return 4.0;
         case PERIOD_H1:  return 3.0;
         case PERIOD_M30: return 2.0;
         case PERIOD_M15: return 1.5;
         case PERIOD_M5:  return 1.0;
         default:         return 0.5;
        }
     }

public:
                     CMTFAnalyzer() : m_symbol(""), m_count(0) {}

   //--- context_tfs: ordered list of timeframes to track
   void              Init(const string symbol, const ENUM_TIMEFRAMES &context_tfs[],
                          const int swing_strength, const int lookback)
     {
      m_symbol = symbol;
      m_count  = MathMin(ArraySize(context_tfs), APEX_MTF_MAX);
      for(int i = 0; i < m_count; i++)
        {
         m_tfs[i]     = context_tfs[i];
         m_weights[i] = TFWeight(context_tfs[i]);
         m_swings[i].Init(symbol, context_tfs[i], swing_strength, lookback);
         m_structs[i].Init(symbol, context_tfs[i], &m_swings[i]);
        }
     }

   void              Update()
     {
      for(int i = 0; i < m_count; i++)
         m_structs[i].Update();
     }

   //--- weighted directional bias in [-1, +1]
   double            Bias() const
     {
      double score = 0, total = 0;
      for(int i = 0; i < m_count; i++)
        {
         total += m_weights[i];
         if(m_structs[i].IsBullish())      score += m_weights[i];
         else if(m_structs[i].IsBearish()) score -= m_weights[i];
        }
      return (total > 0) ? score / total : 0;
     }

   ENUM_APEX_DIRECTION BiasDirection(const double min_conviction = 0.30) const
     {
      double b = Bias();
      if(b >= min_conviction)  return DIR_LONG;
      if(b <= -min_conviction) return DIR_SHORT;
      return DIR_NONE;
     }

   //--- access a specific timeframe's structure engine
   CStructureEngine *Structure(const ENUM_TIMEFRAMES tf)
     {
      for(int i = 0; i < m_count; i++)
         if(m_tfs[i] == tf) return &m_structs[i];
      return NULL;
     }

   CSwingEngine     *Swings(const ENUM_TIMEFRAMES tf)
     {
      for(int i = 0; i < m_count; i++)
         if(m_tfs[i] == tf) return &m_swings[i];
      return NULL;
     }

   string            BiasText() const
     {
      double b = Bias();
      if(b >= 0.6)  return "Strong Bull";
      if(b >= 0.3)  return "Bull";
      if(b <= -0.6) return "Strong Bear";
      if(b <= -0.3) return "Bear";
      return "Neutral";
     }
  };
//+------------------------------------------------------------------+
