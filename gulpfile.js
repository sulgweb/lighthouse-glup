const gulp = require('gulp');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const printer = require('lighthouse/lighthouse-cli/printer');
const Reporter = require('lighthouse/lighthouse-core/report/report-generator');
const fs = require('fs-extra');
const desktopConfig = require('./lighthouse-desktop-config.js');
const mobileConfig = require('./lighthouse-mobile-config.js');
const del = require("del")
const reportList = require("./reportList")
let chrome

async function write(file, report) {
    try {
        await fs.outputFile(file, report);
        return true
    } catch (e) {
        console.log("error while writing report ", e);
    }
}

// 开启chorome
async function launchChrome() {
    //let chrome;
    try {
        chrome = await chromeLauncher.launch({
            chromeFlags: [
                "--disable-gpu",
                "--no-sandbox",
                "--headless"
            ],
            enableExtensions: true,
            logLevel: "error"
        });
        console.log("chrome.port:", chrome.port)
        return {
            port: chrome.port,
            chromeFlags: [
                "--headless"
            ],
            logLevel: "error"
        }
    } catch (e) {
        console.log("Error while launching Chrome ", e);
    }
}

// 启动lighthouse测试
async function lighthouseRunner(url, opt, config) {
    try {
        return await lighthouse(url, opt, config);
    } catch (e) {
        console.log("Error while running lighthouse");
    }
}

// 生成报告
function genReport(result) {
    return Reporter.generateReport(result.lhr, 'html');
}

async function run(url, timestamp, num, config) {
    let chromeOpt = await launchChrome();
    let result = await lighthouseRunner(url, chromeOpt, config);
    let report = genReport(result);
    // 保存报告
    await printer.write(report, 'html', `./cases/lighthouse-report@${timestamp}-${num}.html`);
    result.lhr.audits['first-meaningful-paint'].rawValue;
    let res = {
        audits:{
            "first-contentful-paint":result.lhr.audits['first-meaningful-paint']
        },
        categories:result.lhr.categories,
        lighthouseVersion:result.lhr.lighthouseVersion,
        requestedUrl:result.lhr.requestedUrl
    }
    // 关闭chrome
    await chrome.kill();
    return res;//result.lhr
}

// 清理数据
gulp.task('clean:report', function (cb) {
    del([
        'cases/**/*',
        'summary/report/**/*',
    ], cb);
    cb()
});

gulp.task('create:report-desktop', async function (cb) {
    let timestamp = Date.now();
    let spent = [];
    for (let i = 0; i < reportList.length; i++) {
        spent.push(await run(reportList[i], timestamp, i, desktopConfig));
    }
    let template = await fs.readFileSync('./summary/template/template.html', 'utf-8');
    let summary = Reporter.replaceStrings(template, [{
        search: '%%TIME_SPENT%%',
        replacement: JSON.stringify(spent)
    }, {
        search: '%%TIMESTAMP%%',
        replacement: timestamp
    }]);
    await write(`./summary/report/summary@${timestamp}.html`, summary)
    cb()
})

gulp.task('create:report-mobile', async function (cb) {
    let timestamp = Date.now();
    let spent = [];
    for (let i = 0; i < reportList.length; i++) {
        spent.push(await run(reportList[i], timestamp, i, mobileConfig));
    }
    // 替换模板中的内容
    let template = await fs.readFileSync('./summary/template/template.html', 'utf-8');
    let summary = Reporter.replaceStrings(template, [{
        search: '%%TIME_SPENT%%',
        replacement: JSON.stringify(spent)
    }, {
        search: '%%TIMESTAMP%%',
        replacement: timestamp
    }]);
    await write(`./summary/report/summary@${timestamp}.html`, summary)
    cb()
})

// gulp.task("start",["clean:report","creat:report"])
// gulp.series：按照顺序执行
// gulp.paralle：可以并行计算
gulp.task("start-desktop", gulp.series("clean:report","create:report-desktop"), function () {})
gulp.task("start-mobile", gulp.series("clean:report","create:report-mobile"), function () {})