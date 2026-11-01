package kr.saguk.studio;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.*;
import android.view.View;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {
 private WebView web;
 private ValueCallback<Uri[]> choose;
 private String exportText;
 private static final int OPEN=10,SAVE=11;
 private static final String ORIGIN="https://app.saguk.local";
 @Override public void onCreate(Bundle state){
  super.onCreate(state);web=new WebView(this);setContentView(web);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMediaPlaybackRequiresUserGesture(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setBackgroundColor(0xff10120f);web.addJavascriptInterface(new FilesBridge(),"SagukAndroid");
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    Uri u=request.getUrl();
    if(!"https".equals(u.getScheme())||!"app.saguk.local".equals(u.getHost()))return denied();
    String path=u.getPath();if(path==null||path.equals("/"))path="/index.html";
    if(path.contains("..")||path.contains("\\"))return denied();
    try{String mime=path.endsWith(".html")?"text/html":path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".json")?"application/json":"application/octet-stream";return new WebResourceResponse(mime,"UTF-8",getAssets().open("www"+path));}catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",null,new ByteArrayInputStream(new byte[0]));}
   }
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
    Uri u=r.getUrl();if("https".equals(u.getScheme())&&"app.saguk.local".equals(u.getHost()))return false;
    if(r.isForMainFrame()&&("https".equals(u.getScheme())||"http".equals(u.getScheme()))){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}}return true;
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(choose!=null)choose.onReceiveValue(null);choose=callback;
    Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);
    String[] types=params.getAcceptTypes();String type="application/json";for(String t:types)if(t.startsWith("image/")){type="image/*";break;}i.setType(type);
    try{startActivityForResult(i,OPEN);}catch(Exception e){choose.onReceiveValue(null);choose=null;}return true;
   }
  });
  web.loadUrl(ORIGIN+"/index.html");
 }
 private WebResourceResponse denied(){return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",null,new ByteArrayInputStream(new byte[0]));}
 public class FilesBridge {
  @JavascriptInterface public void saveText(final String name,final String text,final String mime){runOnUiThread(()->{
   if(exportText!=null){result("다른 파일을 저장 중입니다.");return;}exportText=text;
   Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");i.putExtra(Intent.EXTRA_TITLE,name.replaceAll("[\\\\/:*?\"<>|]","_"));
   try{startActivityForResult(i,SAVE);}catch(Exception e){exportText=null;result("파일 저장창을 열지 못했습니다.");}
  });}
 }
 private void result(String message){web.evaluateJavascript("window.dispatchEvent(new CustomEvent('saguk-export-result',{detail:"+JSONObject.quote(message)+"}));",null);}
 @Override protected void onActivityResult(int request,int code,Intent data){
  super.onActivityResult(request,code,data);
  if(request==OPEN&&choose!=null){choose.onReceiveValue(code==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);choose=null;}
  if(request==SAVE){final String text=exportText;exportText=null;
   if(code!=RESULT_OK||data==null||data.getData()==null){result("파일 저장을 취소했습니다.");return;}
   final Uri uri=data.getData();new Thread(()->{try(OutputStream stream=getContentResolver().openOutputStream(uri,"wt")){if(stream==null)throw new IOException();stream.write(text.getBytes(StandardCharsets.UTF_8));runOnUiThread(()->result("파일을 저장했습니다."));}catch(Exception e){runOnUiThread(()->result("파일 저장에 실패했습니다. 다시 내보내 주세요."));}}).start();
  }
 }
 @Override protected void onPause(){if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('saguk-app-pause'));",null);super.onPause();}
 @Override public void onBackPressed(){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){const b=d.querySelector('[data-import-cancel],[data-action=close-dialog]');if(b)b.click();else d.close();return true;}if(document.querySelector('#app.map-fullscreen')){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));return true;}window.dispatchEvent(new Event('saguk-app-pause'));return false;})()",handled->{if(!"true".equals(handled))moveTaskToBack(true);});}
 @Override protected void onDestroy(){if(choose!=null)choose.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("SagukAndroid");web.destroy();}super.onDestroy();}
}
