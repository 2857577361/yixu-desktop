package local.yixu.mobile;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle savedInstanceState){registerPlugin(YixuNativePlugin.class);super.onCreate(savedInstanceState);}
}
