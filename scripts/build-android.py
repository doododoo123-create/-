"""Build the offline, release-signed trial APK with Android SDK build-tools35."""
from pathlib import Path
import os,json,secrets,subprocess,zipfile,hashlib
ROOT=Path(__file__).resolve().parents[1]
SDK=Path(os.environ.get('ANDROID_SDK_ROOT','/workspace/.android-sdk'))
TOOLS=SDK/'build-tools/35.0.0';JAR=SDK/'platforms/android-35/android.jar'
BUILD=ROOT/'.artifacts/android';BUILD.mkdir(parents=True,exist_ok=True)
def run(args,**kw):
 subprocess.run([str(a) for a in args],cwd=ROOT,check=True,**kw)
run(['node','scripts/prepare-android.mjs'])
for folder in ['classes','dex']:(BUILD/folder).mkdir(exist_ok=True)
run([TOOLS/'aapt2','compile','--dir',ROOT/'android-native/res','-o',BUILD/'resources.zip'])
run([TOOLS/'aapt2','link','-I',JAR,'--manifest',ROOT/'android-native/AndroidManifest.xml','-o',BUILD/'unsigned.apk','-A',BUILD/'assets',BUILD/'resources.zip'])
run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-source','8','-target','8','-bootclasspath',str(JAR)+os.pathsep+str(TOOLS/'core-lambda-stubs.jar'),'-d',BUILD/'classes',ROOT/'android-native/src/kr/saguk/studio/MainActivity.java'])
with zipfile.ZipFile(BUILD/'classes.jar','w') as z:
 for p in (BUILD/'classes').rglob('*.class'):z.write(p,p.relative_to(BUILD/'classes'))
run(['java','-cp',TOOLS/'lib/d8.jar','com.android.tools.r8.D8','--min-api','26','--lib',JAR,'--output',BUILD/'dex',BUILD/'classes.jar'])
with zipfile.ZipFile(BUILD/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as z:z.write(BUILD/'dex/classes.dex','classes.dex')
run([TOOLS/'zipalign','-f','4',BUILD/'unsigned.apk',BUILD/'aligned.apk'])
private=Path(os.environ.get('SAGUK_SIGNING_DIR',str(ROOT.parent/'.android-signing')));private.mkdir(mode=0o700,exist_ok=True)
config=private/'saguk-signing.json';key=private/'saguk-release.jks'
if not config.exists():
 config.write_text(json.dumps({'password':secrets.token_urlsafe(32)}));config.chmod(0o600)
env=dict(os.environ,SAGUK_KEY_PASSWORD=json.loads(config.read_text())['password'])
if not key.exists():
 run(['keytool','-genkeypair','-keystore',key,'-alias','saguk','-storepass:env','SAGUK_KEY_PASSWORD','-keypass:env','SAGUK_KEY_PASSWORD','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Saguk Studio,OU=Android,O=Saguk Project,C=KR'],env=env)
 key.chmod(0o600)
output=Path(os.environ.get('SAGUK_APK_OUTPUT',str(ROOT.parent/'shared/saguk-android')));output.mkdir(parents=True,exist_ok=True)
apk=output/'Saguk-Studio-0.46.1-Android-1.apk'
run(['java','-jar',TOOLS/'lib/apksigner.jar','sign','--ks',key,'--ks-key-alias','saguk','--ks-pass','env:SAGUK_KEY_PASSWORD','--key-pass','env:SAGUK_KEY_PASSWORD','--out',apk,BUILD/'aligned.apk'],env=env)
run(['java','-jar',TOOLS/'lib/apksigner.jar','verify','--verbose','--print-certs',apk])
run([TOOLS/'aapt','dump','badging',apk])
proof={'gameVersion':'0.46.1','androidVersion':'0.46.1-android.1','package':'kr.saguk.studio','minAndroid':'8.0','apkBytes':apk.stat().st_size,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'signed':True,'physicalAndroidDeviceTested':False}
(output/'검증정보.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2));print(json.dumps(proof,ensure_ascii=False))
