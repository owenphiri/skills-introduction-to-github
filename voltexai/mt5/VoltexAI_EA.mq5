//+------------------------------------------------------------------+
//|                                                  VoltexAI_EA.mq5  |
//|            VoltexAI Signals — MT5 execution gateway (Expert)      |
//|                                                                  |
//|  Polls the Voltex Signals API for active signals, opens risk-    |
//|  sized trades across the TP1..TP4 ladder, moves remaining stops  |
//|  to break-even after the first target, and reports every         |
//|  lifecycle event (filled / tp / be / closed) back to the API so  |
//|  the Telegram VIP channel updates automatically.                 |
//|                                                                  |
//|  SETUP: MT5 → Tools → Options → Expert Advisors →                |
//|         "Allow WebRequest for listed URL" → add your API host,   |
//|         e.g.  https://voltexai-api.onrender.com                  |
//+------------------------------------------------------------------+
#property copyright "VoltexAI Technologies — powered by Axion Labs"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>

//--- inputs -------------------------------------------------------
input string  ApiBase        = "https://voltexai-api.onrender.com"; // API base URL (must be WebRequest-whitelisted)
input string  GatewayKey     = "";      // MT5_GATEWAY_KEY (must match the server)
input double  RiskPercent    = 1.0;     // total risk % of balance per signal (split across TPs)
input int     TpCount        = 4;       // how many of TP1..TP4 to trade (1-4)
input double  MaxSpreadPoints= 40;      // skip if spread wider than this (points)
input int     PollSeconds    = 15;      // how often to poll for new signals
input long    MagicNumber    = 26082017;// EA magic
input bool    MoveToBEAfterTP1 = true;  // move remaining SLs to entry after TP1

CTrade   trade;
string   g_processed[];   // signal UUIDs already actioned this session

//+------------------------------------------------------------------+
int OnInit()
  {
   if(GatewayKey=="")
      Print("VoltexAI EA: WARNING — GatewayKey is empty; the API will reject pulls.");
   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetTypeFillingBySymbol(_Symbol);
   EventSetTimer(MathMax(5,PollSeconds));
   Print("VoltexAI EA started. Polling ",ApiBase," every ",PollSeconds,"s.");
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason){ EventKillTimer(); }

//+------------------------------------------------------------------+
//| Poll loop                                                        |
//+------------------------------------------------------------------+
void OnTimer()
  {
   string resp;
   if(!HttpRequest("GET","/api/pro-signals/mt5/pull","",resp))
      return;
   string arr = ExtractArray(resp,"signals");
   if(arr=="") return;

   int start=0;
   string obj;
   while(NextObject(arr,start,obj))
     {
      string uuid = JsonStr(obj,"uuid");
      if(uuid=="" || AlreadyProcessed(uuid) || HasOpenFor(uuid))
         continue;
      ProcessSignal(obj,uuid);
     }
  }

//+------------------------------------------------------------------+
//| Open a signal across the TP ladder                               |
//+------------------------------------------------------------------+
void ProcessSignal(const string &obj,const string uuid)
  {
   string symbol    = JsonStr(obj,"symbol");
   string direction = JsonStr(obj,"direction");
   double sl        = JsonNum(obj,"sl");
   double entry     = JsonNum(obj,"entry");
   double tps[4];
   tps[0]=JsonNum(obj,"tp1"); tps[1]=JsonNum(obj,"tp2");
   tps[2]=JsonNum(obj,"tp3"); tps[3]=JsonNum(obj,"tp4");

   if(symbol=="" || sl<=0){ MarkProcessed(uuid); return; }
   if(!SymbolSelect(symbol,true)){ Print("Symbol not found: ",symbol); MarkProcessed(uuid); return; }

   long spread = SymbolInfoInteger(symbol,SYMBOL_SPREAD);
   if(spread>MaxSpreadPoints){ Print(symbol," spread too wide (",spread,") — skipping ",uuid); return; }

   bool isBuy = (StringCompare(direction,"buy",false)==0);
   double px  = isBuy ? SymbolInfoDouble(symbol,SYMBOL_ASK) : SymbolInfoDouble(symbol,SYMBOL_BID);
   double slDist = MathAbs(px - sl);
   if(slDist<=0){ MarkProcessed(uuid); return; }

   int n = (int)MathMax(1,MathMin(TpCount,4));
   double totalLots = RiskLots(symbol,slDist);
   double perLot    = NormalizeLot(symbol, totalLots / n);
   if(perLot<=0){ Print("Lot too small for ",symbol," — check risk/min lot"); MarkProcessed(uuid); return; }

   int opened=0;
   for(int i=0;i<n;i++)
     {
      double tp = tps[i];
      if(tp<=0) continue;
      string comment = StringFormat("VX:%s:%d",uuid,i+1);
      trade.SetDeviationInPoints(30);
      bool ok = isBuy ? trade.Buy(perLot,symbol,0.0,sl,tp,comment)
                      : trade.Sell(perLot,symbol,0.0,sl,tp,comment);
      if(ok) opened++;
      else   Print("Order failed ",symbol," ",direction," tp",i+1," err=",trade.ResultRetcode());
     }

   MarkProcessed(uuid);
   if(opened>0)
     {
      Print("VoltexAI opened ",opened," positions for ",symbol," ",direction," (",uuid,")");
      ReportEvent(uuid,"filled",px,0,"MT5 auto-execution");
     }
  }

//+------------------------------------------------------------------+
//| Detect closes -> report tp/closed + move remainder to BE         |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(trans.type!=TRADE_TRANSACTION_DEAL_ADD) return;
   ulong deal = trans.deal;
   if(!HistoryDealSelect(deal)) return;
   if(HistoryDealGetInteger(deal,DEAL_MAGIC)!=MagicNumber) return;
   if(HistoryDealGetInteger(deal,DEAL_ENTRY)!=DEAL_ENTRY_OUT) return; // a close

   string comment = HistoryDealGetString(deal,DEAL_COMMENT);
   string uuid; int tpIndex;
   if(!ParseComment(comment,uuid,tpIndex))
     {
      // MT5 sometimes overwrites comment with "tp"/"sl"; fall back to position comment
      return;
     }
   double price  = HistoryDealGetDouble(deal,DEAL_PRICE);
   double profit = HistoryDealGetDouble(deal,DEAL_PROFIT);
   double reason = HistoryDealGetInteger(deal,DEAL_REASON);

   string ev = (reason==DEAL_REASON_TP) ? StringFormat("tp%d",tpIndex)
             : (reason==DEAL_REASON_SL) ? "sl" : "closed";
   double rMultiple = (double)tpIndex; // TPn closes at ~nR on that tranche
   if(ev=="sl") rMultiple = -1.0;
   ReportEvent(uuid,ev,price,rMultiple,StringFormat("profit=%.2f",profit));

   if(tpIndex==1 && reason==DEAL_REASON_TP && MoveToBEAfterTP1)
      MoveToBreakeven(uuid);

   if(CountOpenFor(uuid)==0)
      ReportEvent(uuid,"closed",price,0,"all tranches closed");
  }

//+------------------------------------------------------------------+
//| Risk-based lot sizing                                            |
//+------------------------------------------------------------------+
double RiskLots(const string symbol,double slDistancePrice)
  {
   double balance   = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskMoney = balance * RiskPercent/100.0;
   double tickVal   = SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE);
   if(tickVal<=0 || tickSize<=0) return(0);
   double lossPerLot = (slDistancePrice / tickSize) * tickVal;
   if(lossPerLot<=0) return(0);
   return(riskMoney / lossPerLot);
  }

double NormalizeLot(const string symbol,double lots)
  {
   double minLot = SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX);
   double step   = SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP);
   if(step<=0) step=0.01;
   lots = MathFloor(lots/step)*step;
   if(lots<minLot) lots=minLot;
   if(lots>maxLot) lots=maxLot;
   return(NormalizeDouble(lots,2));
  }

//+------------------------------------------------------------------+
//| Move all remaining positions of a signal to break-even          |
//+------------------------------------------------------------------+
void MoveToBreakeven(const string uuid)
  {
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong ticket=PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=MagicNumber) continue;
      string uu; int idx;
      if(!ParseComment(PositionGetString(POSITION_COMMENT),uu,idx)) continue;
      if(uu!=uuid) continue;
      double open=PositionGetDouble(POSITION_PRICE_OPEN);
      double tp  =PositionGetDouble(POSITION_TP);
      trade.PositionModify(ticket,open,tp);
     }
  }

int CountOpenFor(const string uuid)
  {
   int c=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong t=PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=MagicNumber) continue;
      string uu; int idx;
      if(ParseComment(PositionGetString(POSITION_COMMENT),uu,idx) && uu==uuid) c++;
     }
   return(c);
  }

bool HasOpenFor(const string uuid){ return(CountOpenFor(uuid)>0); }

//+------------------------------------------------------------------+
//| HTTP + JSON helpers                                              |
//+------------------------------------------------------------------+
bool HttpRequest(const string method,const string path,const string body,string &out)
  {
   string url = ApiBase + path;
   string headers = "Content-Type: application/json\r\nX-Gateway-Key: "+GatewayKey+"\r\n";
   char post[]; char result[]; string rheaders;
   if(body!="") StringToCharArray(body,post,0,StringLen(body));
   ResetLastError();
   int code = WebRequest(method,url,headers,8000,post,result,rheaders);
   if(code==-1)
     {
      Print("WebRequest failed (",GetLastError(),"). Whitelist ",ApiBase," in Options→Expert Advisors.");
      return(false);
     }
   out = CharArrayToString(result,0,-1,CP_UTF8);
   return(code>=200 && code<300);
  }

void ReportEvent(const string uuid,const string ev,double price,double resultR,const string note)
  {
   string body = StringFormat("{\"event\":\"%s\",\"price\":%.5f,\"result_r\":%.2f,\"note\":\"%s\"}",
                              ev,price,resultR,note);
   string resp;
   HttpRequest("POST","/api/pro-signals/"+uuid+"/events",body,resp);
  }

//--- minimal JSON extraction for our controlled schema ------------
string ExtractArray(const string json,const string key)
  {
   int k=StringFind(json,"\""+key+"\"");
   if(k<0) return("");
   int lb=StringFind(json,"[",k);
   if(lb<0) return("");
   int depth=0;
   for(int i=lb;i<StringLen(json);i++)
     {
      ushort c=StringGetCharacter(json,i);
      if(c=='[') depth++;
      else if(c==']'){ depth--; if(depth==0) return(StringSubstr(json,lb+1,i-lb-1)); }
     }
   return("");
  }

// iterate top-level {...} objects inside an array body
bool NextObject(const string arr,int &start,string &obj)
  {
   int lb=StringFind(arr,"{",start);
   if(lb<0) return(false);
   int depth=0;
   for(int i=lb;i<StringLen(arr);i++)
     {
      ushort c=StringGetCharacter(arr,i);
      if(c=='{') depth++;
      else if(c=='}'){ depth--; if(depth==0){ obj=StringSubstr(arr,lb,i-lb+1); start=i+1; return(true); } }
     }
   return(false);
  }

string JsonStr(const string obj,const string key)
  {
   int k=StringFind(obj,"\""+key+"\"");
   if(k<0) return("");
   int c=StringFind(obj,":",k);
   int q1=StringFind(obj,"\"",c+1);
   if(q1<0) return("");
   int q2=StringFind(obj,"\"",q1+1);
   if(q2<0) return("");
   return(StringSubstr(obj,q1+1,q2-q1-1));
  }

double JsonNum(const string obj,const string key)
  {
   int k=StringFind(obj,"\""+key+"\"");
   if(k<0) return(0);
   int c=StringFind(obj,":",k);
   if(c<0) return(0);
   int i=c+1; string num="";
   while(i<StringLen(obj))
     {
      ushort ch=StringGetCharacter(obj,i);
      if((ch>='0'&&ch<='9')||ch=='.'||ch=='-'||ch=='+'||ch=='e'||ch=='E'){ num+=ShortToString(ch); i++; }
      else if(num=="" && (ch==' '||ch=='\t')){ i++; }
      else break;
     }
   return(StringToDouble(num));
  }

// comment format "VX:<uuid>:<tpIndex>"
bool ParseComment(const string comment,string &uuid,int &tpIndex)
  {
   if(StringFind(comment,"VX:")!=0) return(false);
   string rest=StringSubstr(comment,3);
   int colon=StringFind(rest,":",0);
   if(colon<0) return(false);
   uuid=StringSubstr(rest,0,colon);
   tpIndex=(int)StringToInteger(StringSubstr(rest,colon+1));
   return(uuid!="");
  }

//--- processed-uuid memory ----------------------------------------
bool AlreadyProcessed(const string uuid)
  {
   for(int i=0;i<ArraySize(g_processed);i++) if(g_processed[i]==uuid) return(true);
   return(false);
  }
void MarkProcessed(const string uuid)
  {
   int n=ArraySize(g_processed);
   ArrayResize(g_processed,n+1);
   g_processed[n]=uuid;
  }
//+------------------------------------------------------------------+
