// ==UserScript==
// @name         百度云直链批量传输
// @version      1.1.2-TEST
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
    let batchTransferBtn = document.createElement("button");
    batchTransferBtn.btnType = 0;
    batchTransferBtn.id = BUTTON_EXIST_ID;
    batchTransferBtn.originalInnerText = "批量传输";
    batchTransferBtn.innerText = batchTransferBtn.originalInnerText;
    batchTransferBtn.onclick = (e) => batchTransfer.call(batchTransferBtn, e);
    // noinspection JSValidateTypes
    batchTransferBtn.style = `background-color: #f0faff; border-radius: 16px; margin-left: 5px; padding-left: 16px; padding-right: 16px; border: 0; \
       margin-right: 5px; height: 32px; width: 100px`;

    buttonGroup.append(batchTransferBtn);
  }

  const PATH_SPLIT_REGEX = /[/\\]/,
    URLS_SPLIT_REGEX = /\s/;

  async function parseFolder(e) {
    let files = e?.target?.files;
    if (files) {
      let texts = [];
      for (const file of files) {
        if (file.type === "text/plain") {
          let text = await file.text();
          texts.push(text.trim());
        }
      }
      let urls = texts.join("\n");

      let urlsTextarea = document.getElementById("urls-textarea");
      if (urlsTextarea) {
        urlsTextarea.value = urlsTextarea.value + urls;
      } else {
        urlsTextarea.value = urls;
      }

    } else {
      unsafeWindow.alert("未能获得到文件");
    }
  }

  async function batchTransfer() {
    const now = new Date();
    if (!document.getElementById("batch-transfer-panel")) {
      document.body.insertAdjacentHTML("afterend", `
<div id="batch-transfer-panel" style="position: absolute;top: 50%;left: 50%;transform: translate(-50%,-50%);border: 1px solid;background-color: white;height: 585px;">
<div id="batch-transfer-panel-close" style="float: right;margin-right: 2px;margin-top: -2px;font-size: x-large;cursor: pointer;">X</div>
<div style="padding: 30px">
<table id="main-table" style="width: 650px;height: 500px;">
<tr>
    <td style="width: 80px">链接:</td>
    <td style="height: 0;"><textarea id="urls-textarea" rows="20" style="padding: 5px;border: 1px solid;width: 100%"></textarea></td>
</tr>
<tr style="text-align: center;height: 10%;">
    <td colspan="2"><button id="parse-folder-button" style="background-color: rgba(0,0,0,0); padding: 0 16px 0 16px; border: 1px solid; height: 32px">解析文件</input></td>
</tr>
<tr>
    <td>存储地址:</td>
    <td><input style="width: 100%;border: 1px solid;padding: 5px;" id="target-path" type="text" value="/${now.getFullYear()}年/${now.getMonth() + 1}月/${now.getDate()}号"/></td>
</tr>
</table>
<div id="status-table-div" style="display: none;width: 650px;height: 490px;margin-bottom: 10px;overflow: auto;border: 1px solid;padding: 5px;">
 <table id="status-table"></table>
</div>
<div style="width: 100%;text-align: center;">
<button id="transfer-button" style="background-color: rgba(0,0,0,0);font-size: x-large;padding: 5px 23px 5px 23px; border: 1px solid; height: 45px">转存</button>
</div>
</div>
</div>
`);
    }
    let parseFolderButton = document.getElementById("parse-folder-button");
    parseFolderButton.onclick = function () {
      let batchUploadInput = document.createElement("input");
      batchUploadInput.type = "file";
      batchUploadInput.webkitdirectory = true;
      batchUploadInput.multiple = true;
      batchUploadInput.onchange = (e) => parseFolder.call(parseFolderButton, e);
      batchUploadInput.click();
    };

    let transferButton = document.getElementById("transfer-button");
    transferButton.onclick = () => {
      transferButton.disabled = true;

      let mainTable = document.getElementById("main-table");
      mainTable.attributeStyleMap.set("display", "none");

      let urlsTextarea = document.getElementById("urls-textarea");
      let urls = urlsTextarea.value
        .split(URLS_SPLIT_REGEX)
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      urls = populateUrls(urls);

      if (urls.length === 0) {
        unsafeWindow.alert("未能获得有效的链接");
        return;
      }

      let statusTable = document.getElementById("status-table");
      document.getElementById("status-table-div").attributeStyleMap.delete("display");

      for (let i = 0; i < urls.length; i++) {
        let url = urls[i];
        statusTable.insertAdjacentHTML("beforeend",
          `<tr style="height: 10px"><td style="width: 540px">${url}</td><td id="${"url-td-" + i}">未处理</td></tr>`
        )
      }

      transferButton.innerText = "转存中";
      console.log("batch-save; 有效的 urls = " + urls);

      doBatchTransfer(urls, document.getElementById("target-path").value)
        .finally(() => {
          transferButton.onclick = () => {
            unsafeWindow.location.reload();
          }
          transferButton.disabled = false;
          transferButton.innerText = "完成";
        })
    }

    document.getElementById("batch-transfer-panel-close").onclick = () => {
      if (transferButton.disabled === false) {
        document.getElementById("batch-transfer-panel").remove();
      }
    }
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

  async function doBatchTransfer(urls, targetPath) {
    // noinspection JSUnresolvedReference
    const globalContext = {
      baseUrl: "https://pan.baidu.com",
      targetPath: undefined,
      bdstoken: unsafeWindow.locals.userInfo.bdstoken
    };

    if (targetPath) {
      globalContext.targetPath = targetPath.split(PATH_SPLIT_REGEX)
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

      let currContext = {
        globalContext: globalContext,
        surl: url.substring(url.lastIndexOf("/") + 2, url.lastIndexOf("?")),
        passCode: url.substring(url.lastIndexOf("pwd=") + 4),
        url: url
      }

      let statusTd = document.getElementById("url-td-" + urlIndex);
      try {
        statusTd.innerText = "验证提取码";
        await verifyPassCode(currContext);

        statusTd.innerText = "获得分享数据";
        await fullCurrContext(currContext);

        statusTd.innerText = "转存中";
        await transferFile(currContext);

        statusTd.innerText = "完成";
      } catch (e) {
        console.error(e);
        statusTd.innerText = "失败: " + e.message;
      }
    }

    localStorage[LAST_OPT_INFO_LOCAL_STOREAGE_KEY] = JSON.stringify({
      targetPath: globalContext.targetPath
    });

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
