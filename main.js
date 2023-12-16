// ==UserScript==
// @name         百度云直链批量传输
// @version      1.0.1-alpha
// @description  百度云直链批量传输
// @author       deycoesr@gmail.com
// @match        *://pan.baidu.com/disk/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pan.baidu.com
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  const BUTTON_EXIST_ID = "button-gjoiqp2ielldhabsdi123",
    // 最后一次操作信息存储 KEY
    LAST_OPT_INFO_LOCAL_STOREAGE_KEY = "lastOpt:gaojap21ogbiualsjhd1";

  // https://pan.baidu.com/union/doc/okumlx17r
  const ERRNO_MAP_MESSAGE = new Map([
    [2, "参数错误"],
    [31023, "参数错误"],
    [111, "access token 失效"],
    [-6, "身份验证失败"],
    [6, "不允许接入用户数据"],
    [31034, "命中接口频控"],
    [2131, "该分享不存在"],
    [10, "转存文件已经存在"],
    [-3, "文件不存在"],
    [-31066, "文件不存在"],
    [11, "自己发送的分享"],
    [255, "转存数量太多"],
    [12, "批量转存出错"],
    [-1, "权益已过期"],
    [-7, "文件或目录名错误或无权访问"],
    [-10, "云端容量已满"],
    [-8, "文件或目录已存在"],
  ]);

  function getErrorMessage(errno) {
    let errorMessage = ERRNO_MAP_MESSAGE.get(errno);
    if (!errorMessage) {
      errorMessage = "未知的错误";
    }
    return errorMessage;
  }

  function newError(errno) {
    let errorMessage = getErrorMessage(errno);
    return new Error(errorMessage);
  }

  setInterval(() => {
    if (!document.getElementById(BUTTON_EXIST_ID)) {
      let buttonGroup = document.querySelector(
        ".wp-s-core-pan__header-tool-bar--action > .wp-s-agile-tool-bar > .wp-s-agile-tool-bar__header > .wp-s-agile-tool-bar__h-group > .u-button-group"
      );
      if (!buttonGroup) {
        // 兼容旧版
        buttonGroup = document.querySelector(".tcuLAu");
      }
      if (buttonGroup) {
        appendBtn(buttonGroup);
      }
    }
  }, 200);

  function appendBtn(buttonGroup) {
    let batchSaveBtn = document.createElement("button");
    batchSaveBtn.btnType = 0;
    batchSaveBtn.id = BUTTON_EXIST_ID;
    batchSaveBtn.originalInnerText = "批量传输";
    batchSaveBtn.innerText = batchSaveBtn.originalInnerText;
    batchSaveBtn.onclick = (e) => batchSave.call(batchSaveBtn, e);
    // noinspection JSValidateTypes
    batchSaveBtn.style = `background-color: #f0faff; border-bottom-left-radius: 16px; \
       border-top-left-radius: 16px; margin-left: 5px; padding-left: \
       16px; padding-right: 8px; border: 0; \
       margin-right: -1px; height: 32px;`;

    buttonGroup.append(batchSaveBtn);

    let batchUploadBtn = document.createElement("button");
    batchUploadBtn.btnType = 1;
    batchUploadBtn.originalInnerText = "选择文件夹";
    batchUploadBtn.innerText = batchUploadBtn.originalInnerText;
    batchUploadBtn.onclick = function () {
      let batchUploadInput = document.createElement("input");
      batchUploadInput.type = "file";
      batchUploadInput.webkitdirectory = true;
      batchUploadInput.multiple = true;
      batchUploadInput.onchange = (e) => parseFolder.call(batchUploadBtn, e);
      batchUploadInput.click();
    };
    // noinspection JSValidateTypes
    batchUploadBtn.style = `background-color: #f0faff; border-bottom-right-radius: 16px; \
      border-top-right-radius: 16px; padding-right: 16px; \
      padding-left: 8px; margin-right: 5px; \
      border: 0; height: 32px`;

    buttonGroup.append(createDividerElement());
    buttonGroup.append(batchUploadBtn);

    let lastOptInfo = localStorage[LAST_OPT_INFO_LOCAL_STOREAGE_KEY];
    if (typeof lastOptInfo === "string") {
      lastOptInfo = JSON.parse(lastOptInfo);
      const btnTypeAry = [batchSaveBtn, batchUploadBtn];

      let showLastOptInfoIntervalId,
        remainSeconds = 6;
      let showLastOptInfoFun = () => {
        remainSeconds--;
        let targetBtn = btnTypeAry[lastOptInfo.btnType];
        targetBtn.innerText =
          "上次共传输 " + lastOptInfo.total + " 个链接 (" + remainSeconds + ")";
        if (remainSeconds < 1) {
          targetBtn.innerText = targetBtn.originalInnerText;
          localStorage.removeItem(LAST_OPT_INFO_LOCAL_STOREAGE_KEY);
          clearInterval(showLastOptInfoIntervalId);
        }
      };
      showLastOptInfoFun.call();
      showLastOptInfoIntervalId = setInterval(showLastOptInfoFun, 1000);
    }
  }

  function createDividerElement() {
    let elem = document.createElement("span");
    // noinspection JSValidateTypes
    elem.style = "border-left: 1px solid black; height: 11px; margin-top: 11px";
    return elem;
  }

  const PATH_SPLIT_REGEX = /[/\\]/,
    URLS_SPLIT_REGEX = /\s/;

  async function parseFolder(e) {
    let files = e?.target?.files;
    if (files) {
      let texts = [];
      for (const file of files) {
        if (file.type === "text/plain") {
          texts.push(await file.text());
        }
      }
      let urls = texts.reduce((left, right) => left + "\n" + right, "");

      await doBatchSave.call(this, urls);
    } else {
      unsafeWindow.alert("未能获得到文件");
    }
  }

  async function batchSave() {
    let urlsText = prompt("以 '空格' 或 '换行' 作为间隔符\n输入分享链接:");
    if (!urlsText) {
      return;
    }

    await doBatchSave.call(this, urlsText);
  }

  /**
   * 处理 url空格提取码 的情况
   */
  function populateUrls(urls) {
    for (let index = 0; index < urls.length; index++) {
      let url = urls[index];
      if (url.startsWith("http") && url.indexOf("?pwd=") < 0) {
        // 如果是链接并且没有提取码
        // 那么默认提取码是下一个
        let pwd = urls[index + 1];
        if (pwd.startsWith("http")) {
          const errorMsg = "链接 '" + url + "' 无法找到对应的提取码";
          unsafeWindow.alert(errorMsg);
          throw new Error(errorMsg);
        }
        urls[index] = url + "?pwd=" + pwd;
        urls.splice(index + 1, 1);
      }
    }

    for (let url of urls) {
      if (!url.startsWith("http")) {
        const errorMsg = "无效的链接 '" + url + "'";
        unsafeWindow.alert(errorMsg);
        throw new Error(errorMsg);
      }
    }

    // 去掉重复
    return [...new Set(urls)];
  }

  async function doBatchSave(urlsText) {
    // noinspection JSUnresolvedReference
    const globalContext = {
      baseUrl: "https://pan.baidu.com",
      targetPath: undefined,
      bdstoken: unsafeWindow.locals.userInfo.bdstoken
    };

    let urls = urlsText
      .split(URLS_SPLIT_REGEX)
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    urls = populateUrls(urls);

    if (urls.length === 0) {
      unsafeWindow.alert("未能获得有效的链接");
      return;
    }

    // noinspection JSUnusedGlobalSymbols
    this.innerText = "共获得 " + urls.length + " 个有效链接";
    console.log("batch-save; 有效的 urls = " + urls);

    const now = new Date();

    let targetFolders = prompt(
      "以 '/' 或 '\\' 作为分隔符\n无效路径默认为根目录\n输入存储路径:",
      `${now.getFullYear()}年/${now.getMonth() + 1}月/${now.getDate()}号`
    );

    let errorMap = new Map();

    if (targetFolders) {
      globalContext.targetPath = targetFolders.split(PATH_SPLIT_REGEX)
        .map((url) => url.trim())
        .filter((path) => path.length > 0)
        .reduce((prev, curr) => prev + "/" + curr, "");
      try {
        await createFolderIfNecessary(globalContext);
      } catch (e) {
        console.error(e);
        unsafeWindow.alert(e.message);
      }
    } else {
      globalContext.targetPath = "/";
    }

    for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
      let url = urls[urlIndex];
      // noinspection JSUnusedGlobalSymbols
      this.innerText =
        "正在处理第 " + (urlIndex + 1) + " 个链接，共 " + urls.length + " 个";

      let currContext = {
        globalContext: globalContext,
        surl: url.substring(url.lastIndexOf("/") + 2, url.lastIndexOf("?")),
        passCode: url.substring(url.lastIndexOf("pwd=") + 4),
        url: url
      }

      try {
        await verifyPassCode(currContext);

        await fullCurrContext(currContext);

        await transferFile(currContext);
      } catch (e) {
        console.error(e);
        errorMap.set(url, e.message);
      }
    }

    localStorage[LAST_OPT_INFO_LOCAL_STOREAGE_KEY] = JSON.stringify({
      btnType: this.btnType,
      total: urls.length,
    });

    if (errorMap.size > 0) {
      let errorMsg = [...errorMap.entries()]
        .map(([url, errorReason]) => "[" + url + "]的失败原因: " + errorReason)
        .reduce((prev, curr) => prev + "\n" + curr);
      unsafeWindow.alert(errorMsg);
    }

    unsafeWindow.location.reload();
  }

  async function createFolderIfNecessary(globalContext) {
    let params = new URLSearchParams();
    params.set("path", globalContext.targetPath);
    params.set("isdir", "1");
    params.set("block_list", "[]");
    // 文件命名策略，默认1
    // 0 为不重命名，返回冲突
    // 1 为只要path冲突即重命名
    // 2 为path冲突且block_list不同才重命名
    // 3 为覆盖，需要与预上传precreate接口中的rtype保持一致
    params.set("rtype", "0");

    let response = await fetch(
      `${globalContext.baseUrl}/api/create?a=commit&bdstoken=${globalContext.bdstoken}&clienttype=0&app_id=250528&web=1&dp-logid=44926600600253610057`,
      {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: params.toString()
      }
    );

    let responseJson = await response.json();
    // noinspection JSUnresolvedReference
    let errno = responseJson.errno;
    if (errno === 0) {
      return;
    }
    if (errno === -8) {
      // -8 文件或目录已存在
      return;
    }

    throw newError(errno);
  }

  async function transferFile(currContext) {

    let params = new URLSearchParams();
    params.set("fsidlist", `[${currContext.fsId}]`);
    params.set("path", currContext.globalContext.targetPath);

    let responseJson = await (await fetch(
      `${currContext.globalContext.baseUrl}/share/transfer?shareid=${currContext.shareId}&from=${currContext.shareUk}&sekey=${currContext.bdclnd}&ondup=newcopy&async=1&channel=chunlei&web=1&bdstoken=${currContext.globalContext.bdstoken}&clienttype=0`,
      {
        method: "POST",
        referrer: `https://pan.baidu.com/share/init?surl=${currContext.surl}&pwd=${currContext.passCode}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "Cookie": `BDCLND=${currContext.bdclnd};`
        },
        body: params.toString(),
      }
    )).json();

    // noinspection JSUnresolvedReference
    let errno = responseJson.errno;
    if (errno !== 0) {
      throw newError(errno);
    }
  }

  async function fullCurrContext(currContext) {
    let responseText = await (await fetch(currContext.url)).text();
    currContext.shareId = responseText.match(/"shareid":(\d+?),"/)[1];
    currContext.shareUk = responseText.match(/"share_uk":"(\d+?)","/)[1];
    currContext.fsId = responseText.match(/"fs_id":(\d+?),"/)[1];
  }

  async function verifyPassCode(currContext) {
    let params = new URLSearchParams();

    params.set("pwd", currContext.passCode);
    params.set("vcode", "");
    params.set("vcode_str", "")
    let response = await fetch(
      `${currContext.globalContext.baseUrl}/share/verify?surl=${currContext.surl}&bdstoken=${currContext.globalContext.bdstoken}&t=${new Date().getTime()}&channel=chunlei&web=1&clienttype=0`,
      {
        method: "POST",
        referrer: `https://pan.baidu.com/share/init?surl=${currContext.surl}&pwd=${currContext.passCode}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: params.toString(),
      }
    );
    let responseJson = await response.json();
    // noinspection JSUnresolvedReference
    let errno = responseJson.errno;
    if (errno === 0) {
      // noinspection JSUnresolvedReference
      currContext.bdclnd = responseJson.randsk;
    } else {
      throw newError(errno);
    }
  }
})();
