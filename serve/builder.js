
const loadConfig = require('./config')
const util = require('./util')
const cache = require('./cache')
const Concat = require('concat-with-sourcemaps')

let buildPromise = null

exports.load = async () => {
    return new Promise(function (resolve, reject) {
        if (buildPromise) {
            buildPromise.then(function (res) {
                resolve(res)
            }, reject)
        } else {
            build().then(resolve, reject)
        }
    }).catch(function (err, stdout, stderr) {
        console.log(err, stdout, stderr)
    })
}

exports.buildPage= async (file)=>{

    return loadConfig().then(config => {
        // let pages = config.pages
        let route = file.replace(/\.js$/, '')
        // let isPage = true
        return util.parseJavascript(config, file).then(
          ({ code, map }) => {
            const concat = new Concat(true, file, '\n')
            concat.add(null, `__wxRoute = "${route}";__wxRouteBegin = true;`)
            concat.add(null, code, map)
            return customizeCode(concat.content.toString())
          },
          err => {
            util.notifyError(err)
          }
        )
      })
}

let build = exports.build = async () => {
    buildPromise = Promise.all([loadConfig(), util.globJSfiles()]).then(res => {
        let [config, files] = res.map(util.normalizePath)
        // 通过真实存在的文件和配置文件中的pages进行排除， 排除pages之外的js用来编译
        let utils = util.groupFiles(files, config)
        let paths = utils.concat('app.js') // 所有js

        return Promise
            .all(paths.map(p => util.parseJavascript(config, p)))
            .then(arr => {
                let obj = paths.map((path, i) => {
                    return { path, code: arr[i].code, map: arr[i].map }
                })
                return concatFiles(obj)
            })
    })
    return buildPromise
}

function concatFiles(obj) {
    // 连接所有编译后的js
    cache.set('codes', obj)
    let concat = new Concat(true, 'app-service.js', ';')
    for (let item of obj) {
        concat.add(item.path, item.code, item.map)
    }
    const moduleCodes = customizeCode(concat.content.toString())
    return moduleCodes
}


function customizeCode(str) {
    return str.replace(/WeixinJSBridge/g, 'ServiceJSBridge')
    // .replace(/([^a-zA-Z/])wx\./g, '$1wd.')
    // .replace(/Object\.defineProperty\(\s*wx\s*,/g, 'Object.defineProperty(wd,')
    // .replace(/([^a-zA-Z/])Reporter/g, '$1SReporter')
}