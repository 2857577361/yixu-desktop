package local.yixu.mobile;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.content.Intent;
import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSArray;
import java.util.ArrayList;
import java.util.LinkedList;
import java.nio.charset.StandardCharsets;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
@CapacitorPlugin(name="YixuNative")
public class YixuNativePlugin extends Plugin {
 @PluginMethod public void readSharedURL(PluginCall call){Intent intent=getActivity().getIntent();String text=Intent.ACTION_SEND.equals(intent.getAction())?intent.getStringExtra(Intent.EXTRA_TEXT):null;JSObject out=new JSObject();out.put("url",text==null?"":text);intent.removeExtra(Intent.EXTRA_TEXT);call.resolve(out);}
 private SecretKey key() throws Exception {KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);String alias="yixu-cloud-auth";if(!store.containsAlias(alias)){KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");gen.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());gen.generateKey();}return (SecretKey)store.getKey(alias,null);}
 @PluginMethod public void writeSecret(PluginCall call){try{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());String encrypted=Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(c.doFinal(call.getString("value","{}").getBytes("UTF-8")),Base64.NO_WRAP);getContext().getSharedPreferences("yixu-private",0).edit().putString("auth",encrypted).commit();call.resolve();}catch(Exception e){call.reject("登录凭证保存失败",e);}}
 @PluginMethod public void readSecret(PluginCall call){try{String v=getContext().getSharedPreferences("yixu-private",0).getString("auth","");String plain="{}";if(!v.isEmpty()){String[] bits=v.split(":");Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(bits[0],Base64.NO_WRAP)));plain=new String(c.doFinal(Base64.decode(bits[1],Base64.NO_WRAP)),"UTF-8");}JSObject out=new JSObject();out.put("value",plain);call.resolve(out);}catch(Exception e){call.reject("登录凭证读取失败，请重新登录",e);}}

 @PluginMethod public void writeLanSecret(PluginCall call){try{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());String v=Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(c.doFinal(call.getString("value","null").getBytes("UTF-8")),Base64.NO_WRAP);getContext().getSharedPreferences("yixu-private",0).edit().putString("lan",v).commit();call.resolve();}catch(Exception e){call.reject("配对保存失败",e);}}
 @PluginMethod public void readLanSecret(PluginCall call){try{String v=getContext().getSharedPreferences("yixu-private",0).getString("lan","");String plain="null";if(!v.isEmpty()){String[] bits=v.split(":");Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(bits[0],Base64.NO_WRAP)));plain=new String(c.doFinal(Base64.decode(bits[1],Base64.NO_WRAP)),"UTF-8");}JSObject out=new JSObject();out.put("value",plain);call.resolve(out);}catch(Exception e){call.reject("配对读取失败",e);}}
 private boolean discovering=false;
 @PluginMethod public void discoverLan(PluginCall call){getActivity().runOnUiThread(()->{
  if(discovering){JSObject r=new JSObject();r.put("services",new JSArray());call.resolve(r);return;}
  discovering=true;NsdManager manager=(NsdManager)getContext().getSystemService(Context.NSD_SERVICE);ArrayList<JSObject> found=new ArrayList<>();LinkedList<NsdServiceInfo> queue=new LinkedList<>();boolean[] resolving={false},finished={false};Handler handler=new Handler(Looper.getMainLooper());Runnable[] next={null};
  next[0]=()->{if(resolving[0]||finished[0]||queue.isEmpty())return;resolving[0]=true;NsdServiceInfo service=queue.removeFirst();try{manager.resolveService(service,new NsdManager.ResolveListener(){public void onResolveFailed(NsdServiceInfo info,int code){handler.post(()->{resolving[0]=false;next[0].run();});}public void onServiceResolved(NsdServiceInfo info){handler.post(()->{if(!finished[0]&&info.getHost()!=null){String host=info.getHost().getHostAddress();if(host!=null&&!host.contains(":")){JSObject item=new JSObject();item.put("url","http://"+host+":"+info.getPort());byte[] id=info.getAttributes().get("id"),name=info.getAttributes().get("name");item.put("serverId",id==null?"":new String(id,StandardCharsets.UTF_8));item.put("name",name==null?info.getServiceName():new String(name,StandardCharsets.UTF_8));found.add(item);}}resolving[0]=false;next[0].run();});}});}catch(Exception e){resolving[0]=false;next[0].run();}};
  NsdManager.DiscoveryListener listener=new NsdManager.DiscoveryListener(){public void onDiscoveryStarted(String type){}public void onServiceFound(NsdServiceInfo info){handler.post(()->{queue.add(info);next[0].run();});}public void onServiceLost(NsdServiceInfo info){}public void onDiscoveryStopped(String type){}public void onStartDiscoveryFailed(String type,int code){}public void onStopDiscoveryFailed(String type,int code){}};
  try{manager.discoverServices("_yixu._tcp.",NsdManager.PROTOCOL_DNS_SD,listener);}catch(Exception ignored){}
  handler.postDelayed(()->{finished[0]=true;discovering=false;try{manager.stopServiceDiscovery(listener);}catch(Exception ignored){}JSArray items=new JSArray();for(JSObject item:found)items.put(item);JSObject result=new JSObject();result.put("services",items);call.resolve(result);},4500);
 });}
}
