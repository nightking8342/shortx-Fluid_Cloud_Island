importClass(org.json.JSONArray);
importClass(org.json.JSONObject);
importClass(org.json.JSONTokener);
importClass(android.os.Handler);
importClass(android.os.Looper);
importPackage(android.view);
importPackage(android.widget);
importPackage(android.content);
importPackage(android.graphics);
importClass(android.graphics.drawable.GradientDrawable);
importClass(android.graphics.PixelFormat);
importClass(android.view.WindowManager);
importClass(java.lang.Runnable);
importClass(java.lang.Thread);
importClass(android.app.ActivityOptions);
importClass(android.graphics.Rect);
importClass(android.graphics.Point);
importClass(android.view.Surface);
importClass(android.app.ActivityManager);
importClass(android.content.pm.PackageManager);
importClass(android.os.UserHandle);
importClass(android.net.Uri);
importClass(Packages.tornaco.apps.shortx.core.proto.action.ShellCommand);
importClass(Packages.tornaco.apps.shortx.core.proto.action.WriteClipboard);
importClass(android.view.Gravity);
importClass(android.view.MotionEvent);
importClass(android.util.DisplayMetrics);
importClass(android.content.Context); importClass(java.io.FileReader);
importClass(java.io.BufferedReader);
importPackage(java.net);
importPackage(java.io);
importPackage(java.lang);
importPackage(java.util.concurrent);
importClass(Packages.tornaco.apps.shortx.core.proto.action.ShowToast);
// GitHub仓库信息全局变量
var GITHUB_OWNER = "nightking8342";
var GITHUB_REPO = "shortx-Fluid_Cloud_Island";
var GITHUB_BRANCH = "main";

var netruleerror = { "rules": [], "nolinkrules": [] };
var rulesnum = { "rules": 0, "nolinkrules": 0 };
var rulessuccessnum = { "rules": 0, "nolinkrules": 0 };
function showToast(text) {
    action = ShowToast.newBuilder().setMessage(text).build();
    shortx.executeAction(action);
}

function getnetconfig(rulename) {
    function readStreamAsString(inputStream) {
        var reader = new BufferedReader(new InputStreamReader(inputStream, "UTF-8"));
        var sb = new StringBuilder();
        var line;
        while ((line = reader.readLine()) != null) {
            sb.append(line).append("\n");
        }
        reader.close();
        return sb.toString().trim();
    }
    function httpGet(urlStr) {
        try {
            var url = new URL(urlStr);
            var conn = url.openConnection();
            conn.setRequestProperty("User-Agent", "Rhino-Script/1.0");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            var code = conn.getResponseCode();
            if (code >= 400) {
                var errStream = conn.getErrorStream();
                var msg = errStream ? readStreamAsString(errStream) : "HTTP " + code;
                throw new Error("HTTP " + code + ": " + msg);
            }
            return readStreamAsString(conn.getInputStream());
        } catch (e) {
            throw new Error("请求失败: " + urlStr + " -> " + (e.javaException ? e.javaException.getMessage() : e));
        }
    }
    function fetchJsonList() {
        var owner = GITHUB_OWNER;
        var repo = GITHUB_REPO;
        var branch = GITHUB_BRANCH;
        var folder = rulename;
        var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + folder + "?ref=" + branch;
        var rawBase = "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + branch + "/" + folder;
        try {
            var jsonResponse = httpGet(apiUrl);
            var fileList = JSON.parse(jsonResponse);
            var jsonFiles = [];
            for (var i = 0; i < fileList.length; i++) {
                var item = fileList[i];
                if (item.type === "file" && item.name.toLowerCase().endsWith(".json")) {
                    jsonFiles.push(item.name);
                }
            }
            if (jsonFiles.length === 0) {
                return {
                    success: [],
                    failed: [{
                        filename: "none",
                        message: "未找到任何 .json 文件"
                    }]
                };
            } else {
                rulesnum[rulename] = jsonFiles.length;
            }
            var success = [];
            var failed = [];
            var executor = Executors.newFixedThreadPool(8);
            var futures = [];
            for (var i = 0; i < jsonFiles.length; i++) {
                var filename = jsonFiles[i];
                var fileUrl = rawBase + "/" + filename;
                var task = new Callable({
                    call: function (name, url) {
                        return function () {
                            try {
                                var content = httpGet(url);
                                var jsonObj = JSON.parse(content);
                                return {
                                    success: true,
                                    data: jsonObj,
                                    filename: name
                                };
                            } catch (e) {
                                return {
                                    success: false,
                                    filename: name,
                                    message: e.message
                                };
                            }
                        };
                    }(filename, fileUrl)
                });
                futures.push(executor.submit(task));
            }
            executor.shutdown();
            if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
                return {
                    success: [],
                    failed: [{
                        filename: "timeout",
                        message: "多线程下载超时"
                    }]
                };
            }
            for (var i = 0; i < futures.length; i++) {
                try {
                    var result = futures[i].get();
                    if (result.success) {
                        success.push(result.data);
                    } else {
                        failed.push({
                            filename: result.filename,
                            message: result.message
                        });
                    }
                } catch (e) {
                    failed.push({
                        filename: "unknown",
                        message: "Future 获取失败: " + e.message
                    });
                }
            }
            return {
                success: success,
                failed: failed
            };
        } catch (e) {
            return {
                success: [],
                failed: [{
                    filename: "fetch_list_failed",
                    message: e.message
                }]
            };
        }
    }
    var result = fetchJsonList();
    netruleerror[rulename] = result.failed;
    return result.success;
}

function replaceAll(text, target, replacement) {
    var pattern = new RegExp(target, "g");
    return text.replace(pattern, replacement);
}

function writeConfigToFile(filePath, config, bz) {
    importClass(java.io.File);
    importClass(java.io.FileOutputStream);
    importClass(java.io.OutputStreamWriter);
    importClass(java.io.BufferedWriter);

    var file = new File(filePath);
    var parent = file.getParentFile();
    if (!parent.exists()) {
        parent.mkdirs();
    }
    try {
        var writer = new java.io.FileWriter(filePath);
        var bufferedWriter = new java.io.BufferedWriter(writer);
        var jsonString = JSON.stringify(config, null, 2);
        bufferedWriter.write(bz + jsonString);
        bufferedWriter.close();
    } catch (e) { }
}

function isKeyInObList(obList, key, value) {
    var qvc = obList.some(function (item) {
        return item[key] === value;
    });
    return qvc;
}

function readJsonFile(filePath) {
    try {
        var reader = new BufferedReader(new FileReader(filePath));
        var sb = new java.lang.StringBuilder();
        var line;
        var start = false;
        while ((line = reader.readLine()) != null) {
            var trimmed = line.trim();
            if (!start) {
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    start = true;
                } else {
                    continue;
                }
            }
            sb.append(line);
        }
        reader.close();
        var jsonText = String(sb.toString());
        return JSON.parse(jsonText);
    } catch (e) {
        throw new Error("配置文件读取失败：" + e.message);
    }
}

function findRandomDirWithPrefix(basePath, prefix) {
    var File = java.io.File;
    var dir = new File(basePath);
    if (!dir.exists() || !dir.isDirectory()) {
        return null;
    }
    var list = dir.listFiles();
    if (list == null) {
        return null;
    }
    var result = null;
    for (var i = 0; i < list.length; i++) {
        var file = list[i];
        if (file.isDirectory() && file.getName().startsWith(prefix)) {
            result = file.getName();
            break;
        }
    }
    return basePath + result;
}

var shortxpath = findRandomDirWithPrefix("/data/system/", "shortx");
var uiClosed = false;
var versionName = "";

function configVersion(path) {
    var File = java.io.File;
    var FileInputStream = java.io.FileInputStream;
    var InputStreamReader = java.io.InputStreamReader;
    var BufferedReader = java.io.BufferedReader;
    var file = new File(path);
    if (!file.exists()) {
        return 0;
    }
    var fis = new FileInputStream(file);
    var isr = new InputStreamReader(fis, "UTF-8");
    var br = new BufferedReader(isr);
    br.readLine();
    var secondLine = br.readLine();
    br.close();
    result = parseFloat(secondLine);
    if (isNaN(result)) {
        return 0;
    } else {
        return result;
    }
}

function showCountdownDialogBox(title, text, time) {
    function runOnUiThread(fn) {
        new Handler(Looper.getMainLooper()).post(new Runnable({ run: fn }));
    }
    runOnUiThread(function () {
        var windowManager = context.getSystemService(Context.WINDOW_SERVICE);
        var metrics = new DisplayMetrics();
        windowManager.getDefaultDisplay().getMetrics(metrics);
        var screenWidth = metrics.widthPixels;
        var screenHeight = metrics.heightPixels;

        var layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.TRANSPARENT);
        var backgroundDrawable = new android.graphics.drawable.GradientDrawable();
        backgroundDrawable.setColor(Color.WHITE);
        backgroundDrawable.setCornerRadius(50);
        layout.setBackground(backgroundDrawable);
        layout.setPadding(40, 40, 40, 40);

        var layoutParams = new WindowManager.LayoutParams(
            parseInt(screenWidth * 0.9),
            parseInt(screenHeight * 0.8),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        layoutParams.gravity = Gravity.CENTER;

        var titleView = new TextView(context);
        titleView.setText(title);
        titleView.setTextSize(22);
        titleView.setTextColor(Color.BLACK);
        titleView.setGravity(Gravity.CENTER);
        titleView.setPadding(0, 0, 0, 20);
        layout.addView(titleView);

        var scrollView = new ScrollView(context);
        var scrollParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1
        );
        scrollView.setLayoutParams(scrollParams);

        var textView = new TextView(context);
        textView.setText(text);
        textView.setTextSize(18);
        textView.setTextColor(Color.DKGRAY);
        textView.setGravity(Gravity.LEFT);
        scrollView.addView(textView);
        layout.addView(scrollView);

        var buttonLayout = new LinearLayout(context);
        buttonLayout.setOrientation(LinearLayout.HORIZONTAL);
        buttonLayout.setGravity(Gravity.CENTER);
        buttonLayout.setPadding(0, 30, 0, 0);
        layout.addView(buttonLayout);

        var closeButton = new Button(context);
        closeButton.setText("下一步");
        closeButton.setTextColor(Color.WHITE);
        closeButton.setEnabled(true);

        function createRoundedDrawable(color) {
            var drawable = new android.graphics.drawable.GradientDrawable();
            drawable.setColor(color);
            drawable.setCornerRadius(30);
            return drawable;
        }
        closeButton.setBackgroundDrawable(createRoundedDrawable(Color.parseColor("#08C661")));

        buttonLayout.addView(closeButton);

        closeButton.setOnClickListener(new View.OnClickListener({
            onClick: function () {
                var writeLocalVar = Packages.tornaco.apps.shortx.core.proto.action.WriteLocalVar.newBuilder()
                    .setVarName("next")
                    .setValueAsString("true")
                    .build();
                shortx.executeAction(writeLocalVar);
                try {
                    windowManager.removeView(layout);
                } catch (e) { }
                uiClosed = true;
            }
        }));

        try {
            windowManager.addView(layout, layoutParams);
        } catch (e) {
            console.log("添加视图失败：" + e);
            uiClosed = true;
        }
    });

    while (!uiClosed) {
        Thread.sleep(200);
    }
}

showCountdownDialogBox(
    "使用说明",
    `    0.此指令为自定义UI指令，稳定性与兼容性远不及预制动作制作的指令，如若出现软重启，死机等问题说明你的系统与指令不适配，为确保您的数据安全，请立即停止使用。更新指令与shortx时可能会清理配置，如有自定义的配置，请在更新前做好配置备份，如更新后因配置文件被清理而无法使用，重新开关指令会重新创建默认配置，同时欢迎提交用于各个app的规则（前往简介处GitHub仓库提交pr）
    
    1.小窗打开功能需要没有中转层才可正常使用（如：空浏览,UrlCheck,其他浏览器打开等），部分应用可能强制挣脱小窗需求，ColorOS无法使用始终全屏打开时需在指令参数出将小窗参数的值从5改为100(coloros识别机制为oplus应用低版本coloros下可能不存在)，如你正在使用请在设置中手动配置浏览器
    
    2.选中提取功能可能需要手动重命名并选择一下上下文菜单触发器
    
    3.流体云单击全屏打开，点击按钮使用小窗打开，顶部时上滑关闭下滑进菜单，底部时上滑进菜单，下滑关闭
    
    4.配置文件解释：见配置文件内顶部区域
    
    5.点击指令的图标，点击执行动作进入图形化配置页面
    
    6.安装附加插件实现点击链接交由指令分发
    
    7.配置文件目录：${shortxpath}/data/Fluid_Cloud_Island
    8.点击下一步后将从GitHub获取在线规则，请确保网络环境可正常连接到GitHub，重新开启指令可更新云端规则`,
    5
);

var configys = {
    "Top_Level_Domain": ["com", "cn", "top", "love", "xyz", "net", "org", "vip", "cloud", "online", "icu", "fun", "work", "tv", "wiki", "email", "plus", "co", "ltd", "shop", "tech", "wang", "site", "xin", "store", "art", "cc", "website", "press", "space", "beer", "luxe", "video", "group", "ren", "fit", "yoga", "pro", "ink", "info", "mobi", "kim", "red", "run", "chat", "cool", "zone", "host", "biz", "me", "so"],
    "Email_Keyword_List": ["qq.com", "126.com", "163.com", "139.com", "gmail.com", "hotmail.com", "sohu.com", "sina.com", "sina.cn", "foxmail.com", "outlook.com", "aliyun.com", "tom.com", "yeah.net", "live.cn", "msn.com"],
    "Extractioncode_Keyword_list": ["提取码：", "密码：", "提取码:", "密码:", "访问码:", "访问码：", "提取码 : "],
    "Use_https_keyword_list": ["123pan.com"],
    "link_blacklist_keywords": ["无"],
    "Window_Configuration": {},
    "Launch_Windowing_Mode": 5,
    "Fluid_Cloud_Position": "顶部",
    "Fluid_Cloud_Position_Offset": 10,
    "Fluid_Cloud_timeout": 3000,
    "browser": "自动",
    "Browser_PackageName_BlackList": [
        "com.jingdong.app.mall",
        "com.taobao.taobao",
        "air.svran.browser.nb",
        "com.trianguloy.urlchecker",
        "com.tmall.wireless",
        "com.thestore.main"
    ],
    "allowChar": "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM#_/+-:?%@=.&,，；;1234567890",
    "show_Multiple_users": true,
    "show_toast": true,
    "extra_default_action": "询问",
    "use_islandNotification": true,
    "pull_small_window": true
};

var configbz = `一.配置版本：
1.5
二.字段解释：
Top_Level_Domain：顶级域名列表
Email_Keyword_List：邮箱关键词列表
Extractioncode_Keyword_list：提取码关键词列表
Use_https_keyword_list：仅https可用的链接关键词列表（链接无请求头时使用）
link_blacklist_keywords：链接黑名单关键词列表(注意是链接内的关键词，不是包名)
Window_Configuration:小窗的大小与位置配置，对象格式{"屏幕尺寸":[]}，其中屏幕尺寸为自然方向的真实尺寸（不受屏幕方向影响，格式：宽X高），每个尺寸对应的数组包含7个参数：竖屏高度 横屏高度 宽高比 竖屏左侧留空 横屏左侧留空 竖屏上侧留空 横屏上侧留空
Launch_Windowing_Mode：可触发小窗的Windowsmode值，coloros为100(会自动识别，旧版本可能不能识别需要修改为100)，米，类原生为5
Fluid_Cloud_Position：流体云显示位置（顶部，底部）
Fluid_Cloud_Position_Offset:流体云位置偏移(向上偏移减小值向下偏移增加值)
Fluid_Cloud_timeout：流体云显示超时时长，超过设定毫秒数无动作浮窗消失
browser:浏览器包名(填自动表示自动识别)
Browser_PackageName_BlackList：浏览器黑名单，识别到的默认浏览器在黑名单内时会重新寻找其他的浏览器
allowChar:允许出现在链接中的字符
show_Multiple_users:显示多用户应用（true 开启/false 关闭）
show_toast:是否显示吐司提示(true 显示/false 不显示)
extra_default_action:附加插件触发时的动作（询问，小窗打开，全屏打开）
use_islandNotification:是否开启超级岛通知
pull_small_window:是否开启小窗拉取功能（true 开启/false 关闭）

三.配置：
`;

if (configVersion(shortxpath + "/data/Fluid_Cloud_Island/config.json") == 0) {
    writeConfigToFile(shortxpath + "/data/Fluid_Cloud_Island/config.json", configys, configbz);
} else {
    var nowConfig = readJsonFile(shortxpath + "/data/Fluid_Cloud_Island/config.json");
    var nowConfigKeys = Object.keys(nowConfig);
    var ysConfigKeys = Object.keys(configys);
    for (var i = 0; i < nowConfigKeys.length; i++) {
        if (ysConfigKeys.includes(nowConfigKeys[i])) {
            if (typeof nowConfig[nowConfigKeys[i]] != "object" || nowConfigKeys[i] == "Window_Configuration") {
                configys[nowConfigKeys[i]] = nowConfig[nowConfigKeys[i]];
            } else {
                for (var j = 0; j < nowConfig[nowConfigKeys[i]].length; j++) {
                    if (!configys[nowConfigKeys[i]].includes(nowConfig[nowConfigKeys[i]][j])) {
                        configys[nowConfigKeys[i]].push(nowConfig[nowConfigKeys[i]][j]);
                    }
                }
            }
        }
    }
    writeConfigToFile(shortxpath + "/data/Fluid_Cloud_Island/config.json", configys, configbz);
}

var ruleVersion = configVersion(shortxpath + "/data/Fluid_Cloud_Island/rules.json");
var nolinkruleVersion = configVersion(shortxpath + "/data/Fluid_Cloud_Island/rules.json");
var rulebz = `一.配置版本：
2.2
二.字段解释：
1.url/intent类型：
"name":"百度网盘",//必填项：名称（随意填）更新时名称不存在于预设中的规则会被保留，否则将会被覆盖
"tigger":["pan\\\\.baidu\\\\.com"],//必填项：触发器(链接满足正则(包含匹配)时触发此条规则)注意点要转义
"type":"url",//必填项：类型(url：设定此条规则为urlschame规则，pkg：设定此条规则为指定包名规则 注：指定包名规则需应用支持打开才可以，否则会报错，intent:设定此条规则为intent规则，格式与url相同)
"check":"bdnetdisk://",//type为url/intent时为必填项：检测（填写目标应用可稳定触发的url或包名，检测是否有对应的应用，没有安装此规则对应应用时不触发）
topcondition:置顶条件(可选项)，满足条件时该规则置顶，格式与rule中的condition相同
"Custom_variable",//(可选项)自定义变量列表，[{"name":"变量名",,"action":执行的操作(可选项默认为match，match：正则匹配，replace：替换，splicing：拼接)"pattern":匹配和替换专属必选项填正则字符串(从text中匹配字符，或替换的目标),"text":匹配替换专属必选项，正则从text中匹配或替换（text填变量名，变量名可为内置的link和input，也可为自定义的变量名）,"index":取正则匹配结果的第几项（match专属可选项，无该字段为默认为1）,"replacement":替换专属必选项，替换成的内容,"valuetext":拼接专属必选项，格式与rule的rule_text相同}]
"rule"://必填项：规则列表["condition":条件列表（可选项，无该项为默认为始终满足，优先级最低）存在该项时取满足且条件数量最多的结果，"many_condition_tactic":多条件策略（可选项，无该项默认为All，All：条件全部满足，Any：任意一个满足，None：全部不满足）"rule_text":含有变量占位符如【link】的urlschame或intent]
条件列表内的条件对象：{condition_type:条件类型（withcode：存在提取码，withoutcode：不存在提取码，cantains：condition_text中包含文本，notcantains：不包含）,condition_text:包含于不包含条件使用的字段（判断该字段是否包含满足正则的文本）,condition_pattern:判断用的正则}

2.pkg类型：
"name":"telegram",//名称（同上）
"tigger":["t\\\\.me"],//触发器（同上）
"type":"pkg",//必填项，该项为pkg时表示设定此条规则为指定应用规则
"pkg":"tg://"//type为pkg时为必填项，填包名或url，用对应的应用打开（如填写包名报错可改为填写确保应用可以打开的urlschame，填写url时会尝试自动匹配活动）
"activityname"//可选项，指定打开链接的活动(如：com.xingin.xhs.routers.RouterPageActivity，pkg字段填写url时会尝试自动匹配)

三.规则：
`;
showToast("正在更新云端规则，请稍后···")
var ruleysConfig = getnetconfig("rules");
if (ruleysConfig.length == 0) {
    showCountdownDialogBox(
        "无法连接到仓库",
        "无法连接到GitHub规则仓库，可挂v后再试",
        3
    );
    throw new Error("无法连接到GitHub仓库");
} else {
    rulessuccessnum["rules"] = ruleysConfig.length;
}
var nolinkbz = `一.配置版本：
2.2
二.字段解释：
name:必填项：名称（随意填）更新时名称不存在于预设中的规则会被保留，否则将会被覆盖
tigger:必填项：触发器(链接满足正则(包含匹配)时触发此条规则)
type:必填项：类型(url：设定此条规则为urlschame规则，intent:设定此条规则为intent规则，格式与url相同,rein:重入，以rule结果为输入重新识别)
check:必填项：检测（填写目标应用可稳定触发的url或包名，检测是否有对应的应用，没有安装此规则对应应用时不触发）
topcondition:置顶条件(可选项)，满足条件时该规则置顶，格式与rule中的condition相同
"Custom_variable",//(可选项)自定义变量列表，[{"name":"变量名",,"action":执行的操作(可选项默认为match，match：正则匹配，replace：替换，splicing：拼接)"pattern":匹配和替换专属必选项填正则字符串(从text中匹配字符，或替换的目标),"text":匹配替换专属必选项，正则从text中匹配或替换（text填变量名，变量名可为内置的link和input，也可为自定义的变量名）,"index":取正则匹配结果的第几项（match专属可选项，无该字段为默认为1）,"replacement":替换专属必选项，替换成的内容,"valuetext":拼接专属必选项，格式与rule的rule_text相同}]
"rule"://必填项：规则列表["condition":条件列表（可选项，无该项为默认为始终满足，优先级最低）存在该项时取满足且条件数量最多的结果，"many_condition_tactic":多条件策略（可选项，无该项默认为All，All：条件全部满足，Any：任意一个满足，None：全部不满足）"rule_text":含有变量占位符如【link】的urlschame或intent]
//"条件列表内的条件对象：{condition_type:条件类型（withcode：存在提取码，withoutcode：不存在提取码，cantains：condition_text中包含文本，notcantains：不包含）,condition_text:包含于不包含条件使用的字段（判断该字段是否包含满足正则的文本）,condition_pattern:判断用的正则}
//title：必填项：可包含自定义键值对占位符的在流体云上显示的标题
//message：必填项：可包含自定义键值对占位符的在流体云标题下方的描述
//icon:选填项，应用包名，强制将图标显示为填写包名的应用对应的图标

三.规则：
`
var nolinkysConfig = getnetconfig("nolinkrules");
if (nolinkysConfig.length == 0) {
    showCountdownDialogBox(
        "无法连接到仓库",
        "无法连接到GitHub规则仓库，可挂v后再试",
        3
    );
    throw new Error("无法连接到GitHub仓库");
} else {
    rulessuccessnum["nolinkrules"] = nolinkysConfig.length;
}

function processRules(nowRules, config, filePath, bz) {
    var zdyRules = [];
    for (var i = 0; i < nowRules.length; i++) {
        if (!isKeyInObList(config, "name", nowRules[i].name)) {
            var Custom_variable = [];
            var KEYS = Object.keys(nowRules[i]);
            if (typeof nowRules[i].rule == "object") {
                if (typeof nowRules[i].condition !== "string" && ["object", "undefined", "null"].includes(typeof nowRules[i].topcondition)) {
                    zdyRules.push(nowRules[i]);
                } else if (typeof nowRules[i].condition == "string") {
                    var conditions = [];
                    for (var j = 0; j < nowRules[i].condition.length; j++) {
                        conditions.push({
                            "condition_type": "contains",
                            "condition_text": "input",
                            "condition_pattern": nowRules[i].condition[j]
                        })
                    }
                    zdyRules.push({
                        "name": nowRules[i].name,
                        "tigger": nowRules[i].tigger,
                        "type": nowRules[i].type,
                        "check": nowRules[i].check,
                        "topcondition": {
                            condition: conditions,
                            "many_condition_tactic": "Any"
                        },
                        "Custom_variable": Custom_variable,
                        "rule": nowRules[i].rule
                    });
                } else { continue; }
            } else {
                for (var j = 0; j < KEYS.length; j++) {
                    if (!["name", "tigger", "rule", "type", "check", "condition", "topcondition", "rulewithtqm", "activityname", "pkg"].includes(KEYS[j])) {
                        Custom_variable.push({
                            "name": KEYS[j],
                            "pattern": nowRules[i][KEYS[j]],
                            "text": "link",
                            "index": 1
                        });
                    }
                }
                if (Custom_variable.length === 0) Custom_variable = undefined;
                var topcondition = handleTopCondition(nowRules[i], KEYS);
                zdyRules.push({
                    "name": nowRules[i].name,
                    "tigger": nowRules[i].tigger,
                    "type": nowRules[i].type,
                    "check": nowRules[i].check,
                    "topcondition": topcondition,
                    "Custom_variable": Custom_variable,
                    "rule": [{ "rule_text": nowRules[i].rule }]
                });
                if (KEYS.includes("rulewithtqm")) {
                    zdyRules[zdyRules.length - 1].rule.unshift({
                        "condition": [
                            {
                                "condition_type": "withcode"
                            }
                        ],
                        "many_condition_tactic": "All",
                        "rule_text": replaceAll(nowRules[i].rulewithtqm, "【tqm】", "【code】")
                    });
                }
            }
        }
    }


    writeConfigToFile(filePath, zdyRules.concat(config), bz);
}


function handleTopCondition(rule, KEYS) {
    var topcondition;

    if (!KEYS.includes("topcondition") && KEYS.includes("condition")) {
        var conditions = [];
        for (var j = 0; j < rule.condition.length; j++) {
            conditions.push({
                "condition_type": "contains",
                "condition_text": "input",
                "condition_pattern": rule.condition[j]
            })
        }
        topcondition = {
            condition: conditions,
            "many_condition_tactic": "Any"
        };
    } else if (KEYS.includes("topcondition")) {
        if (typeof rule.topcondition === "object") {
            topcondition = rule.topcondition;
        } else { return undefined; }
    } else {
        topcondition = undefined;
    }

    return topcondition;
}


if (ruleVersion == 0) {
    writeConfigToFile(shortxpath + "/data/Fluid_Cloud_Island/rules.json", ruleysConfig, rulebz);
} else {
    var nowRules = readJsonFile(shortxpath + "/data/Fluid_Cloud_Island/rules.json");
    processRules(nowRules, ruleysConfig, shortxpath + "/data/Fluid_Cloud_Island/rules.json", rulebz);
}


if (nolinkruleVersion == 0) {
    writeConfigToFile(shortxpath + "/data/Fluid_Cloud_Island/nolinkrules.json", nolinkysConfig, nolinkbz);
} else {
    var nowRules = readJsonFile(shortxpath + "/data/Fluid_Cloud_Island/nolinkrules.json");
    processRules(nowRules, nolinkysConfig, shortxpath + "/data/Fluid_Cloud_Island/nolinkrules.json", nolinkbz);
}


writeConfigToFile(shortxpath + "/data/Fluid_Cloud_Island/recordcopy.json", { "CopiedText": false }, "");

var isLowVersion = false;
try {
    console.log("版本检测通过");
} catch (e) {
    isLowVersion = true;
}

if (isLowVersion) {
    showCountdownDialogBox("ShortX版本过低", "请更新至最新版本后使用", 3);
}
var net_rule_sync_error_message = "规则更新部分失败，请更换稳定的网络环境或节点，请确认Android即系统框架未被v排除";
if (netruleerror["rules"].length != 0) {
    net_rule_sync_error_message += "\n链接分发规则共" + rulesnum["rules"] + "个，成功" + rulessuccessnum["rules"] + "个，失败" + netruleerror["rules"].length + "个" + "\n错误信息：\n" + JSON.stringify(netruleerror["rules"], null, 2);
} else {
    showToast("成功更新链接分发规则共" + rulessuccessnum["rules"] + "个");
}
if (netruleerror["nolinkrules"].length != 0) {
    net_rule_sync_error_message += "\n无链接规则共" + rulesnum["nolinkrules"] + "个，成功" + rulessuccessnum["nolinkrules"] + "个，失败" + netruleerror["nolinkrules"].length + "个" + "\n错误信息：\n" + JSON.stringify(netruleerror["nolinkrules"], null, 2);
} else {
    showToast("成功更新无链接规则共" + rulessuccessnum["nolinkrules"] + "个");
}
if (net_rule_sync_error_message != "规则更新部分失败，请更换稳定的网络环境或节点，请确认Android即系统框架未被v排除") {
    showCountdownDialogBox(
        "部分失败",
        net_rule_sync_error_message,
        2
    );
}
function writeFile(path, content) {
    importClass(java.io.File);
    importClass(java.io.FileOutputStream);
    importClass(java.io.OutputStreamWriter);
    importClass(java.io.BufferedWriter);
    var file = new File(path);
    var parent = file.getParentFile();
    if (!parent.exists()) {
        parent.mkdirs();
    }
    var fos = new FileOutputStream(file, false);
    var writer = new BufferedWriter(new OutputStreamWriter(fos, "utf-8"));
    writer.write(content);
    writer.close();
    return "写入成功: " + path;
}
// 从GitHub拉取core.js并进行版本管理
function updateCoreJs() {
    var owner = GITHUB_OWNER;
    var repo = GITHUB_REPO;
    var branch = GITHUB_BRANCH;
    var coreJsPath = shortxpath + "/data/Fluid_Cloud_Island/core.js";
    var versionPath = shortxpath + "/data/Fluid_Cloud_Island/version";
    
    try {
        // 读取本地版本文件
        var localVersion = "0.0.0";
        var localVersionFile = new File(versionPath);
        var needUpdate = false;
        
        if (localVersionFile.exists()) {
            var reader = new BufferedReader(new FileReader(localVersionFile));
            localVersion = reader.readLine() || "0.0.0";
            reader.close();
        } else {
            // 本地版本文件不存在，需要更新
            needUpdate = true;
        }
        
        // 检查core.js是否存在
        if (!new File(coreJsPath).exists()) {
            needUpdate = true;
        }
        
        // 获取远程版本号
        var remoteVersion = "0.0.0";
        var versionUrl = "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + branch + "/version";
        
        try {
            var url = new URL(versionUrl);
            var conn = url.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0");
            
            var is = conn.getInputStream();
            var bis = new BufferedReader(new InputStreamReader(is, "utf-8"));
            remoteVersion = bis.readLine() || "0.0.0";
            bis.close();
            is.close();
        } catch (e) {
            console.log("获取远程版本失败: " + e);
        }
        
        // 比较版本号
        if (!needUpdate) {
            needUpdate = compareVersions(remoteVersion, localVersion) > 0;
        }
        
        // 如果需要更新，下载core.js和更新版本文件
        if (needUpdate) {
            // 下载core.js
            var coreJsUrl = "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + branch + "/core.js";
            try {
                var coreUrl = new URL(coreJsUrl);
                var coreConn = coreUrl.openConnection();
                coreConn.setConnectTimeout(10000);
                coreConn.setReadTimeout(10000);
                coreConn.setRequestProperty("User-Agent", "Mozilla/5.0");
                
                var coreIs = coreConn.getInputStream();
                var coreBis = new BufferedReader(new InputStreamReader(coreIs, "utf-8"));
                var coreContent = "";
                var line;
                while ((line = coreBis.readLine()) != null) {
                    coreContent += line + "\n";
                }
                coreBis.close();
                coreIs.close();
                
                // 写入core.js文件
                var parentDir = new File(coreJsPath).getParentFile();
                if (!parentDir.exists()) {
                    parentDir.mkdirs();
                }
                
                var fos = new FileOutputStream(coreJsPath, false);
                var writer = new BufferedWriter(new OutputStreamWriter(fos, "utf-8"));
                writer.write(coreContent);
                writer.close();
                
                // 更新版本文件
                var versionFos = new FileOutputStream(versionPath, false);
                var versionWriter = new BufferedWriter(new OutputStreamWriter(versionFos, "utf-8"));
                versionWriter.write(remoteVersion);
                versionWriter.close();
                
                // 显示更新成功提示
                showToast("core.js更新成功，版本: " + remoteVersion);
            } catch (e) {
                console.log("下载core.js失败: " + e);
                showToast("core.js更新失败，请检查网络连接");
            }
        } else {
            // 已是最新版本
            showToast("core.js已是最新版本: " + localVersion);
        }
    } catch (e) {
        console.log("更新core.js过程出错: " + e);
        showToast("core.js更新过程出错");
    }
}

// 比较版本号
function compareVersions(newVersion, oldVersion) {
    var newParts = newVersion.split('.');
    var oldParts = oldVersion.split('.');
    
    for (var i = 0; i < Math.max(newParts.length, oldParts.length); i++) {
        var newPart = parseInt(newParts[i] || 0);
        var oldPart = parseInt(oldParts[i] || 0);
        
        if (newPart > oldPart) return 1;
        if (newPart < oldPart) return -1;
    }
    
    return 0;
}

// 执行core.js更新
updateCoreJs();
