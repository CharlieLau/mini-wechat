
const util = require('./util')
const builder = require('./builder')
const version = require('../package.json').version
const cache = require('./cache')
const fs = require('fs')
const parser = require('./parser')

exports.getIndex = async config => {
    let rootFn = await util.loadTemplate('index')
    let pageConfig = await util.loadJSONfiles(config.pages)
    config['window'].pages = pageConfig
    let tabBar = config.tabBar || {}
    let topBar = tabBar.position == 'top'
    return rootFn(
        {
            config: JSON.stringify(config),
            root: config.root,
            topBar: topBar,
            tabbarList: tabBar.list,
            tabStyle:
                `background-color: ${tabBar.backgroundColor}; border-color: ${tabBar.borderStyle}; height: ` +
                (topBar ? 47 : 56) +
                'px;',
            tabLabelColor: tabBar.color,
            tabLabelSelectedColor: tabBar.selectedColor,
            version
        },
        {},
        escape
    )
}

exports.getServiceJs = async () => {
    return builder.load()
}

exports.getAppWxss = async (path) => {
    return loadFile(`${path}.wxss`)
}

exports.getPage= async(path) =>{
    return Promise.all([
        loadFile(path + '.wxml'),
        loadFile(path + '.wxss'),
        builder.buildPage(path + '.js')
    ])
}

function loadFile(p, throwErr = true) {
    if (/\.wxss$/.test(p)) throwErr = false
    return new Promise((resolve, reject) => {
        fs.stat(`./${p}`, (err, stats) => {
            if (err) {
                if (throwErr) return reject(new Error(`file ${p} not found`))
                return resolve('')
            }
            if (stats && stats.isFile()) {
                let content = cache.get(p)
                if (content) {
                    return resolve(content)
                } else {
                    return parser(`${p}`).then(resolve, reject)
                }
            } else {
                return resolve('')
            }
        })
    })
}

