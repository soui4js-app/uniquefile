import * as soui4 from "soui4";
import * as os from "os";
import * as std from "std";
import * as utils from "utils.dll";

var g_workDir="";
//var g_worker;

class FilesLvAdapter extends soui4.SLvAdapter{
	constructor(mainDlg){
		super();
		this.mainDlg = mainDlg;
		this.onGetView= this.getView;
		this.onGetCount = this.getCount;
		this.fileList = []; //prepare a file list.
	}

	getView(pos,pItem,pTemplate){
		if(pItem.GetChildrenCount()==0){
			pItem.InitFromXml(pTemplate);
		}
		let wndName = pItem.FindIChildByName("txt_file");
		wndName.SetWindowText(this.fileList[pos].name);
		wndName.SetAttribute("tip",this.fileList[pos].name,false);
		let wndChkFlag = pItem.FindIChildByName("chk_flag");		
		wndChkFlag.SetCheck(this.fileList[pos].chk_flag);
		soui4.SConnect(wndChkFlag,soui4.EVT_CMD,this,this.onCheckClick);
		let wndExplore = pItem.FindIChildByName("btn_explore");
		soui4.SConnect(wndExplore,soui4.EVT_CMD,this,this.onBtnExplore);
	}

	getItemIndex(pItem){
		let pItemPanel = soui4.QiIItemPanel(pItem);
		let iItem = pItemPanel.GetItemIndex();
		pItemPanel.Release();
		return iItem;
	}

	onBtnExplore(e){
		let btn=soui4.toIWindow(e.Sender());
		let pItem = btn.GetIRoot();
		let iItem= this.getItemIndex(pItem);
		console.log("do explore:",this.fileList[iItem].name);
		utils.SelectFile(this.fileList[iItem].name);
	}

	onCheckClick(e){
		let wndChkFlag=soui4.toIWindow(e.Sender());
		let checked = wndChkFlag.IsChecked();
		let pItem = wndChkFlag.GetIRoot();
		let iItem= this.getItemIndex(pItem);
		this.fileList[iItem].chk_flag = checked;
		console.log("onCheckClick:",iItem,"checked:",checked);
	}

	getCount(){
		return this.fileList.length;
	}

	setFileList(fileList){
		this.fileList = fileList;
		this.notifyDataSetChanged();
	}
}

class FileLvAdapter extends soui4.SLvAdapter{
	constructor(mainDlg){
		super();
		this.mainDlg = mainDlg;
		this.onGetView= this.getView;
		this.onGetCount = this.getCount;
		this.fileList = []; //prepare a file list.
		this.fileList_rep = [];//prepare a file list.
		this.isShowAll = true;
		this.dirtyCount = 0;
		this.adapters = new Map();
	}

	getView(pos,pItem,pTemplate){
		if(pItem.GetChildrenCount()==0){
			pItem.InitFromXml(pTemplate);

			let lbFiles = pItem.FindIChildByName("lb_files");
			let lbFilesApi = soui4.QiIListView(lbFiles);
			let filesAdapter = new FilesLvAdapter(this.mainDlg);
			lbFilesApi.SetAdapter(filesAdapter);
			let adapterPtr = lbFilesApi.GetAdapter();
			console.log("adapterPtr:"+adapterPtr);
			this.adapters.set(adapterPtr,filesAdapter);//save jsAdapter to a map.
			lbFilesApi.Release();
		}
		let fileInfo = this.isShowAll?this.fileList[pos]:this.fileList_rep[pos];
		//file info: {md5,size,pathlist:[path1,path2]};
		let wndMd5 = pItem.FindIChildByName("txt_md5");
		wndMd5.SetWindowText(fileInfo.md5);
		let wndSize = pItem.FindIChildByName("txt_size");
		wndSize.SetWindowText(""+fileInfo.size);

		let lbFiles = pItem.FindIChildByName("lb_files");
		let lbFilesApi = soui4.QiIListView(lbFiles);
		let adapterPtr = lbFilesApi.GetAdapter();
		let filesAdapter = this.adapters.get(adapterPtr);
		filesAdapter.setFileList(fileInfo.pathlist);
		lbFilesApi.SetSel(-1,false);
		lbFilesApi.Release();
	}

	getCount(){
		if(this.isShowAll)
			return this.fileList.length;
		else
			return this.fileList_rep.length;
	}
	
	AddFileInfo(fileInfo){
		let iFind = -1;		
		for(let i=0;i<this.fileList.length;i++){
			if(this.fileList[i].md5 == fileInfo.md5 && this.fileList[i].size == fileInfo.size)
			{
				for(let j=0;j<this.fileList[i].pathlist.length;j++){
					if(fileInfo.path == this.fileList[i].pathlist[j].name)
						return;//same file ignore
				}
				this.fileList[i].pathlist.push({name:fileInfo.path,chk_flag:true});
				iFind = i;
				break;
			}
		}
		
		if(iFind==-1){
			this.fileList.push({md5:fileInfo.md5,size:fileInfo.size,pathlist:[{name:fileInfo.path,chk_flag:false}]});
		}
		this.dirtyCount ++;
		if(this.dirtyCount>10){
			this.update();
		}
	}
	
	update(){
		this.fileList_rep = [];
		for(let i=0;i<this.fileList.length;i++){
			if(this.fileList[i].pathlist.length>1)
			{
				this.fileList_rep.push(this.fileList[i]);
			}
		}
		this.dirtyCount = 0;
		this.notifyDataSetChanged();
	}

	clear(){
		this.fileList=[];
		this.fileList_rep=[];
		this.dirtyCount = 0;
		this.notifyDataSetChanged();
	}

	showAll(bShowAll){
		this.isShowAll = bShowAll;
		this.notifyDataSetChanged();
	}

	deleteSel(allowUndo){
		console.log("do delete sel with allow undo:"+allowUndo);
		let del_count = 0;
		let curList = this.isShowAll?this.fileList:this.fileList_rep;
		for(let i=curList.length-1;i>=0;i--){
			let pathlist = curList[i].pathlist;
			for(let j=pathlist.length-1;j>=0;j--){
				if(pathlist[j].chk_flag){
					console.log("delete file:"+ pathlist[j].name);
					utils.DelFile(pathlist[j].name,allowUndo);
					pathlist.splice(j,1);
					del_count ++;
				}	
			}
			if(pathlist.length == 0){
				curList.splice(i,1);
			}
		}
		this.update();
		soui4.SMessageBox(this.mainDlg.GetHwnd(),"delete files:"+del_count,"done",0);
	}
};

class MainDialog extends soui4.JsHostWnd{
	constructor(){
		super("layout:dlg_main");
		this.onEvt = this.onEvent;
		this.worker = null;
	}

	init(){
		this.EnableDragDrop();
		//enable dropdrop.
		this.edit_output=this.FindIChildByName("edit_output");
		this.prog_scan = this.FindIChildByName("prog_scan");
		
		this.lv_output = this.FindIChildByName("lv_output");
		let lvApi = soui4.QiIListView(this.lv_output);
		this.lv_adapter = new FileLvAdapter(this);
		lvApi.SetAdapter(this.lv_adapter);
		let adapterPtr = lvApi.GetAdapter();
		console.log("adapterPtr:"+adapterPtr);
		lvApi.Release();

		this.dropTarget = new soui4.SDropTarget();
		this.dropTarget.cbHandler = this;
		this.dropTarget.onDrop = this.onDrop;
		this.edit_output.RegisterDragDrop(this.dropTarget);

		soui4.SConnect(this.FindIChildByName("btn_run"),soui4.EVT_CMD,this,this.onBtnRun);
		soui4.SConnect(this.FindIChildByName("btn_stop"),soui4.EVT_CMD,this,this.onBtnStop);
		soui4.SConnect(this.FindIChildByName("btn_close"),soui4.EVT_CMD,this,this.onBtnClose);
		soui4.SConnect(this.FindIChildByName("radio_all"),soui4.EVT_CMD,this,this.onBtnShowAll);
		soui4.SConnect(this.FindIChildByName("radio_repeated"),soui4.EVT_CMD,this,this.onBtnShowRepeated);
		soui4.SConnect(this.FindIChildByName("btn_del_sel"),soui4.EVT_CMD,this,this.onBtnDelSel);
		soui4.SConnect(this.FindIChildByName("btn_clear"),soui4.EVT_CMD,this,this.onBtnClear)
	}

	uninit(){
		let lvapi = soui4.QiIListView(this.lv_output);
		lvapi.SetAdapter(0);
		lvapi.Release();
		this.lv_adapter= null;

		this.edit_output.UnregisterDragDrop();
		this.dropTarget=null;
	}

	onEvent(e){
		if(e.GetID()==8000){//event_init
			this.init();
		}
		return false;
	}
	
	onBtnClear(e){
		this.lv_adapter.clear();
	}

	onBtnDelSel(e){
		let chkUndo = this.FindIChildByName("chk_allow_undo");
		let isAllowUndo = chkUndo.IsChecked();
		this.lv_adapter.deleteSel(isAllowUndo);
	}

	onBtnShowAll(e){
		this.lv_adapter.showAll(true);
	}
	onBtnShowRepeated(e){
		this.lv_adapter.showAll(false);
	}

	onBtnClose(e){
		this.onEvt = 0;
		this.uninit();
		this.DestroyWindow();
	}

	onBtnStop(e){
		if(this.worker!=null)
		{
			console.log("stop worker");
			this.worker.postMessage({ type: "abort",data:100 });
		}	
	}

	onBtnRun(e){
		let buf = new soui4.SStringA();
		this.edit_output.GetWindowText(buf,true);
		let dirs = buf.c_str().split("\r\n");

		let edit_ext = this.FindIChildByName("edit_ext");
		edit_ext.GetWindowText(buf,true);	
		buf.ToLower();
		let exts = buf.c_str().split(" ");

		let edit_md5_length = this.FindIChildByName("edit_md5_length");
		edit_md5_length.GetWindowText(buf,true);
		let md5_length = parseInt(buf.c_str());
		if(md5_length<1024) md5_length = 1024;
		
		this.worker = new os.Worker("./unique_file_worker.js");	
		this.worker.opaque = this;
		this.worker.onmessage = function (e) {
			var ev = e.data;
			switch(ev.type) {
			case "files":
				{
					let progApi = soui4.QiIProgress(this.opaque.prog_scan);
					progApi.SetRange(0,ev.total);
					progApi.SetValue(0);
					progApi.Release();
					console.log("prog",ev.path);
				}
				break;
			case "prog":
				{
					let fileInfo=ev.fileInfo;
					let progApi = soui4.QiIProgress(this.opaque.prog_scan);
					progApi.SetValue(fileInfo.prog+1);
					progApi.Release();					
					this.opaque.lv_adapter.AddFileInfo(fileInfo);
				}
				break;
			case "done":
				/* terminate */
				let _this = this.opaque;
				{
					let progApi = soui4.QiIProgress(_this.prog_scan);
					progApi.SetValue(0);
					progApi.Release();
					_this.lv_adapter.update();
				}
				this.onmessage = null;
				this.opaque = null;
				_this.worker = null;
				console.log("worker finished");
				break;
			}
		};
		this.worker.postMessage({type:"start",dirs:dirs,"exts":exts,"md5_length":md5_length});
	}

	onDrop(fileCount){
		let editApi = soui4.QiIRichEdit(this.edit_output);

		let enumDir = function(folder){
			soui4.log("enumDir dir:"+folder);
			let fstat = os.stat(folder);
			if(!(fstat[0].mode & os.S_IFDIR)){
				return;
			}
			editApi.SetSel(-1,-1,true);
			editApi.ReplaceSel(folder+"\n",false);
			let dirInfo = os.readdir(folder);
			if(dirInfo[1]!=0){
				soui4.log("enumDir dir "+folder+" get error:"+ dirInfo[1]);
				return;
			}
			soui4.log("enumDir dir list:"+dirInfo[0]);
			let subDir = dirInfo[0];
			for(let i=0;i<subDir.length;i++){
				if(subDir[i] == "." || subDir[i]=="..")
					continue;
				let fullname = folder+"\\"+ subDir[i];
				let fstat = os.stat(fullname);
				if(fstat[0].mode & os.S_IFDIR){
					enumDir(fullname);
				}
			}
		}

		for(let i=0;i<fileCount;i++){
			let filename = new soui4.SStringA();
			this.dropTarget.GetDropFileName(i,filename);
			let fn = filename.c_str();
			enumDir(fn);
		}
		editApi.Release();
		this.edit_output.Update();
	}
};


function main(inst,workDir,args)
{
	JSON.stringify
	soui4.log(workDir);
	g_workDir = workDir;

	let theApp = soui4.GetApp();
	let souiFac = soui4.CreateSouiFactory();
	//*
	let resProvider = souiFac.CreateResProvider(1);
	soui4.InitFileResProvider(resProvider,workDir + "\\uires");
	//*/
	/*
	// show how to load resource from a zip file
	let resProvider = soui4.CreateZipResProvider(theApp,workDir +"\\uires.zip","souizip");
	if(resProvider === 0){
		soui4.log("load res from uires.zip failed");
		return -1;
	}
	//*/
	let resMgr = theApp.GetResProviderMgr();
	resMgr.AddResProvider(resProvider,"uidef:xml_init");
	resProvider.Release();
	let hwnd = soui4.GetActiveWindow();
	let hostWnd = new MainDialog();
	hostWnd.Create(hwnd,0,0,0,0);
	hostWnd.SendMessage(0x110,0,0);//send init dialog message.
	hostWnd.ShowWindow(1); //1==SW_SHOWNORMAL
	souiFac.Release();
	let ret= theApp.Run(hostWnd.GetHwnd());
	hostWnd=null;
	soui4.log("js quit");
	return ret;
}

globalThis.main=main;