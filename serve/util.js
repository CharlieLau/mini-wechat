const fs = require('fs-extra')
const path = require('path')
const et = require('et-improve')
const Parallel = require('node-parallel')
const glob= require('glob')
const babel = require('@babel/core')
const Concat = require('concat-with-sourcemaps')
const UglifyJS = require('uglify-js')

exports.copy = function (src, dest, opts) {
  opts = Object.assign(
    {},
    {
      exclude: {
        basename: [],
        extname: []
      }
    },
    opts
  )
  return fs.copy(src, dest, {
    filter: (src, dest) => {
      if (fs.lstatSync(src).isDirectory()) {
        return !~opts.exclude.basename.indexOf(path.basename(src))
      }
      return !~opts.exclude.extname.indexOf(path.extname(src))
    }
  })
}

exports.createFilePromise = async function (distPath, fileName, text, noOutput) {
  if (!text || !distPath || !fileName) return
  let self = this
  const exists = await fs.exists(distPath)

  if (!exists) {
    self.mkdirs(distPath)
  }
  return fs.writeFile(path.join(distPath, fileName), text,'utf8').then(res => {
    if (!noOutput) {
      console.log(`Export ${fileName} Success!`)
    }
  })
}

exports.loadTemplate = function (name) {
  return new Promise(function (resolve, reject) {
    fs.readFile(
      path.resolve(__dirname, `./template/${name}.html`),
      'utf8',
      (err, content) => {
        if (err) return reject(err)
        try {
          resolve(et.compile(content))
        } catch (e) {
          console.error(e.stack)
          reject(e)
        }
      }
    )
  })
}

exports.loadJSONfiles = function (pages) {
  let p = new Parallel()
  let res = {}
  return new Promise((resolve, reject) => {
    for (let page of pages) {
      let file = page + '.json'
      p.add(cb => {
        fs.stat(file, function (err, stat) {
          if (err) reject(err)
          if (stat && stat.isFile()) {
            fs.readFile(file, 'utf8', (err, content) => {
              if (err) return cb()
              try {
                res[page] = JSON.parse(content)
              } catch (e) {
                return cb(new Error(`${file} JSON 解析失败，请检查`))
              }
              cb()
            })
          } else {
            return cb()
          }
        })
      })
    }
    p.done(err => {
      if (err) return reject(err)
      resolve(res)
    })
  })
}

exports.globJSfiles = async ()=>{
  return new Promise((resolve,reject)=>{
      glob(
          '**/*.js',
          {ignore:['node_modules/**/*.js', 'miniChatTmp', 'tmp']},
          (err,files)=>{
              if(err) return reject(err)
              resolve(files)
          }
      )
  })
}

exports.normalizePath=function normalizePath (p) {
  return p
}

exports.groupFiles = function(files,config){
  let pages = config.pages.map(p=>`${p}.js`)
  let utils=[]
  files.forEach(f=>{
    if(f!=='app.js'){
      let index = pages.indexOf(f)
      if (index == -1) {
        utils.push(f)
      } else {
        pages.splice(index, 1)
      }
    }
  })
  pages.length &&
    pages.forEach(function (page) {
      console.log(chalk.red(` ✗ ${page} not found`))
    })
  return utils
}

exports.parseJavascript = (config,_path)=>{
  return  new Promise((resolve,reject)=>{
    let isMod= _path!=='app.js' && config.pages.indexOf(_path.replace(/\.js$/, '')) == -1
    loadJavascript(_path,true,(err,result)=>{
      if (err) return reject(err)
      let concat = new Concat(true, _path, '\n')
      concat .add(null,      `define("${_path}", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,fetch,XMLHttpRequest,WebSocket,webkit,WeixinJSCore,WeixinJSBridge,Reporter){`)
      concat.add(_path, result.code, result.map)
      concat.add(null, '});' + (isMod ? '' : `require("${_path}")`))
      return resolve({
        code: concat.content,
        map: concat.sourceMap
      })
    })
  })

}

exports.parseCssImports = (res,file,cb)=>{
  let re = /\s*@import\s+[^;]+?;/g
  fs.readFile(file, 'utf8', (err, content) => {
    if (err) return cb(err)
    let arr = []
    let p = new Parallel()
    content = content.replace(/\/\*[\s\S]*?\*\//g, '')
    while ((arr = re.exec(content)) !== null) {
      let ms = arr[0].match(/(['"])([^\1]+)\1/)
      if (ms && ms[2]) {
        let f = /^\//.test(ms[2])
          ? ms[2].replace(/^\//, '')
          : path.join(path.dirname(file), ms[2])
        f = normalizePath(f)
        if (res.indexOf(f) == -1) {
          res.push(f)
          p.add(done => {
            parseCssImports(res, f, done)
          })
        }
      }
    }
    p.done(cb)
  })
}

exports.parseImports = function parseImports (res, file, cb) {
  // 解析wxml获取页面所有引入文件路径
  fs.readFile(file, 'utf8', (err, xml) => {
    if (err) return cb(err)
    let re = /<(import|include)\s+[^>]+?>/g
    let arr = []
    let p = new Parallel()
    while ((arr = re.exec(xml)) !== null) {
      let ms = arr[0].match(/src=(['"])([^\1]+)\1/)
      if (ms && ms[2]) {
        let f = /^\//.test(ms[2])
          ? ms[2].replace(/^\//, '')
          : path.join(path.dirname(file), ms[2])
        f = /\.wxml/.test(f) ? f : `${f}.wxml`
        f = normalizePath(f)
        if (res.indexOf(f) == -1) {
          res.push(f)
          p.add(done => {
            parseImports(res, f, done)
          })
        }
      }
    }
    p.done(cb)
  })
}

exports.rmEmptyDirsSync = function (dirname) {
  let self = this
  let paths = fs.readdirSync(dirname)
  if (!paths.length) {
    fs.rmdirSync(dirname)
    return true
  } else {
    let count = 0
    paths.forEach(function (p) {
      p = path.join(dirname, p)
      let stat = fs.statSync(p)
      if (stat.isDirectory()) {
        if (self.rmEmptyDirsSync(p)) {
          count++
        }
      }
    })
    if (paths.length === count) {
      fs.rmdirSync(dirname)
      return true
    }
  }
}

// 创建所有目录
exports.mkdirs = function (dirpath) {
  let self = this
  if (!fs.existsSync(dirpath)) {
    self.mkdirs(path.dirname(dirpath))
    fs.mkdirSync(dirpath)
  }
}

const isProd= process.env.NODE_ENV==='production'

function loadJavascript (full_path, useBabel, cb) {
  if (useBabel) {
    babel.transformFile(
      full_path,
      {
        presets: ['@babel/preset-env'].map(
          require.resolve
        ),
        sourceMaps: !isProd,
        sourceRoot: process.cwd(),
        sourceFileName: full_path,
        babelrc: false,
        ast: false
      },
      function (err, result) {
        if (err) return cb(err)
        if (isProd) {
          result.code = UglifyJS.minify(result.code, { fromString: true }).code
        }
        cb(null, result)
      }
    )
  } else {
    fs.readFile(full_path, 'utf8', function (err, content) {
      if (err) return cb(err)
      cb(null, {
        code: content,
        map: null
      })
    })
  }
}
