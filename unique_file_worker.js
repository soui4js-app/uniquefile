/* Worker code for unique_file_worker.js */
import * as std from "std";
import * as os from "os";
import * as utils from "utils.dll";

var parent = os.Worker.parent;
var bStop = false;

function matchFile(strFn, exts){
    let filename = strFn.toLowerCase();
    let bMatch = false;
    for(let j=0;j<exts.length && !bMatch;j++){
        if(exts[j]=="*"){
            bMatch = true;
        }else if(filename.endsWith(exts[j])){
            bMatch = true;
        }
    }
    return bMatch;
}

function enumFiles(folder,exts){
    let ret=[];
    let dirInfo = os.readdir(folder);
    if(dirInfo[1]!=0){
        console.log("enumDir dir "+folder+" get error:"+ dirInfo[1]);
        return ret;
    }
    let subDir = dirInfo[0];
    for(let i=0;i<subDir.length;i++){
        if(subDir[i] == "." || subDir[i]=="..")
            continue;
        let fullname = folder+"\\"+ subDir[i];
        let fstat = os.stat(fullname);
        if(fstat[0]==null){
            console.log("stat for " + fullname+" failed");
            continue;
        }            
        if(!(fstat[0].mode & os.S_IFDIR)){
            if(matchFile(fullname,exts))
                ret.push({path:fullname,size:fstat[0].size});
        }
    }
    return ret;
}

function handle_msg(e) {
    var ev = e.data;
    switch(ev.type) {
        case "abort":
            console.log("recv abort");
            bStop = true;
            break;
        case "start":{
            parent.postMessage({ type: "enum files" });
            let files = [];
            for(var iDir = 0; iDir <ev.dirs.length && !bStop;iDir++){
                let path = ev.dirs[iDir];
                console.log(path);
                files=files.concat(enumFiles(path,ev.exts));
            }
            if(files.length>0){
                parent.postMessage({ type: "files",total:files.length });
                console.log("enum files:"+files.length);
                for(var ifile = 0;ifile<files.length && !bStop;ifile++){
                    console.log(JSON.stringify(files[ifile]));
                    let md5 = utils.FileMd5Ex(files[ifile].path,ev.md5_length);
                    parent.postMessage({type:"prog",fileInfo:{md5:md5,size:files[ifile].size,path:files[ifile].path,prog:ifile}});
                    parent.poll();
                }
            }
            parent.postMessage({ type: "done" });
            console.log("post msg done");
            parent.onmessage = null;
            break;
        }
    }
}
parent.onmessage = handle_msg;
