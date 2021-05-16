const fs = require('fs')
const merge = require('merge')
const Parallel = require('node-parallel')

let scopeConfig = null


/**
 * TODO: 设置默认的配置，可在ext.json文件中将以下内容覆盖
*/
let default_config = {
    debug: false,
    babel: false,
    appname: 'debug',
    window: {
      backgroundTextStyle: 'light',
      navigationBarBackgroundColor: '#fff',
      navigationBarTitleText: 'WeChat',
      navigationBarTextStyle: 'black'
    },
    userInfo: {
      headUrl:'',
      city: 'Chaoyang',
      gender: 1,
      nickName: 'CharlieLau',
      province: 'Beijing'
    },
    weweb:{
      requestType: "ajax",
    },
    websiteIcon:"",
    websiteTitle:'WeChat'
  }



module.exports =(opt={babel:false})=>{
    return new Promise((resolve,reject)=>{
        const p = new Parallel()

        if(!scopeConfig){
            p.add(done=>{
                fs.readFile('./app.json','utf8',(err,data)=>{
                    if(err) return done(err)

                    try{
                        let config = JSON.parse(data)
                        config.root = config.root || config.pages[0]
                        done(null,config)
                    }catch(e){
                        return done(e)
                    }
                })
            });
            
            if(fs.existsSync('./ext.json')){
                p.add(done=>{
                    fs.readFile('./ext.json','utf8',(err,data)=>{
                        if (err) return done(null, {})
                        try {
                            let config = JSON.parse(data)
                            done(null, config)
                        } catch (e) {
                            return done(e)
                        }
                    })
                })
            }

            p.done((err,results)=>{
                if(err) return reject(err)
                const [ appConfig, extConfig] = results
                let config = merge.recursive(true, default_config, appConfig)
                config = merge.recursive(true, config, extConfig)
                config.appid = config.appid || 'touristappid'
                config.isTourist = config.appid == 'touristappid'
                if(opt && opt.babel!==undefined){
                  config.babel = opt.babel
                }
                scopeConfig = config
                resolve(scopeConfig)
            })
        }else{
            resolve(scopeConfig)
        }
    })
}

