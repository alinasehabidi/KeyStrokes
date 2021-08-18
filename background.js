var googleScriptBaseUrl = 'https://script.google.com/macros/s/AKfycbzvcHD3Uhs-MF1hNgSnZ9P_4QG1nLdnZaffvvMWYIVymz_K5tY/exec',
	syncAccIntervalTime = 60000,
	syncRunTime;

// close google auth window when authorization completed
function setListenerAccountTab()
{
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
        if (tab.status == 'complete')
        {
			if (tab.title.match('message_keystroke__success__close__'))
			{
				chrome.tabs.remove(tabId);
				chrome.runtime.sendMessage({login_successful: true});

				// sync acc keystrokes
				doSyncAccountKeystrokes();
			}
	        if (tab.title.match('message_keystroke__shared__close__') || tab.url.match('redirect_to_message_keystrokes_extension_shared=1'))
	        {
		        var keystrokeId = tab.url.match(/tid=(.*?)(&|$)/);
		        console.log(keystrokeId, "pages/settings.html#shared/"+keystrokeId[1]);
		        if (!keystrokeId)
		        {
			        return;
		        }

		        chrome.tabs.remove(tabId);
		        chrome.tabs.create({url: "pages/settings.html#shared/"+keystrokeId[1]}, function(tab){
			        var callback = function(){
				        return function(){
					        console.log('Reopen shared folder..');
					        chrome.tabs.reload(tab.id);
				        }
			        }(tab);

			        syncSharedKeystrokes(callback);
		        });

	        }
        }
    });
}

setListenerAccountTab();



function doSyncAccountKeystrokes()
{
	if (syncRunTime && Date.now() - syncRunTime < 5000)
	{
		return;
	}
	console.log('doSyncAccountKeystrokes '+syncRunTime);
	syncRunTime = Date.now();

	chrome.storage.local.get({keystrokes : []}, function(obj){

		var localKeystrokes = obj.keystrokes;

		for (var i = 0; i < localKeystrokes.length; i++)
		{
			localKeystrokes[i].content = Base64.encode(localKeystrokes[i].content);
		}

		$.ajax({
			type: 'POST',
			url: googleScriptBaseUrl,
			data: {f: 'sync_acc', ta: JSON.stringify(localKeystrokes)},
			cache: false,
			success: function(data, status, xhr){

				var contentType = xhr.getResponseHeader("content-type") || "";
				if (contentType.indexOf('json') == -1)
				{
					return;
				}
				if (!Array.isArray(data.keystroke_updates))
				{
					return;
				}
				console.log(data);
				var keystrokesAllUpdated = [];

				for (var i = 0; i < data.keystroke_updates.length; i++)
				{
					var temp = JSON.parse(data.keystroke_updates[i][1]);
					temp.content = Base64.decode(temp.content);
					temp.synced_timestamp = data.keystroke_updates[i][0];
					keystrokesAllUpdated.push(temp);
				}
					console.log('keystrokesAllUpdated', keystrokesAllUpdated);

				chrome.storage.local.get({keystrokes : []}, function(obj){
					var localKeystrokes = obj.keystrokes;

					// remove keystrokes that was deleted
					if (Array.isArray(data.keystrokes_deleted))
					{
						for (var i = 0; i < localKeystrokes.length; i++)
						{
							for (var j = 0; j < data.keystrokes_deleted.length; j++)
							{
								if (localKeystrokes[i].id == data.keystrokes_deleted[j])
								{
									localKeystrokes.splice(i, 1);
									// decrement because indexes are recalculated after splice
									i--;
									break;
								}
							}
						}
					}

					for (var i = 0; i < keystrokesAllUpdated.length; i++)
					{
						var isUpdated = false;

						for (var j = 0; j < localKeystrokes.length; j++)
						{
							if (keystrokesAllUpdated[i].id == localKeystrokes[j].id)
							{
								localKeystrokes[j] = keystrokesAllUpdated[i];
								isUpdated = true;
								break;
							}
						}

						// if no previous version updated, then insert new keystroke
						if (!isUpdated)
						{
							localKeystrokes.unshift(keystrokesAllUpdated[i]);
						}
					}

					console.log(localKeystrokes);

					// save to local
					chrome.storage.local.set({'keystrokes': localKeystrokes}, function(){});
				});
			},
			error: function(xhr, status){
				//alert('Error occured! Please try again later');
			}
		});
	});


}


function syncSharedKeystrokes(callback)
{
	if (!callback)
	{
		callback = function(){};
	}

	var params = {
		f: 'get_shared'
	};
	$.ajax({
		type: 'GET',
		url: googleScriptBaseUrl,
		data: params,
		cache: false,
		success: function(data, status, xhr){

			var contentType = xhr.getResponseHeader("content-type") || "";
			// if no json, then not logged in
			if (contentType.indexOf('json') == -1)
			{
				data = [];
			}
			else 
			{
				var dataTmp = [];

				// reverse, new first
				data.reverse();

				for (var i = 0; i < data.length; i++) {
					var obj = JSON.parse(data[i][0]);
					
					dataTmp.push({
						id: obj.id,
						name: obj.name,
						snip: obj.snip,
						subj: obj.subj,
						content: Base64.decode(obj.content),
						shared_by: data[i][1]
					});
				}

				data = dataTmp;
			}
			chrome.storage.local.set({'keystrokes_shared': data}, function(){
				console.log('Synced shared keystrokes:', data);
				return callback(data);
			});
		},
		error: function(xhr, status){
			//alert('Error occured! Please try again later');
			return callback([]);
		}
	});
}

// sync shared keystrokes each 10 minutes
var sharedSyncInterval = setInterval(syncSharedKeystrokes, 600000);

// sync acc keystrokes
var syncAccInterval = setInterval(doSyncAccountKeystrokes, syncAccIntervalTime);


chrome.runtime.onMessage.addListener(function(message, sender, sendResp){
	if (message.func == 'resyncShared')
	{
		syncSharedKeystrokes(sendResp);
		return true;
	}
	if (message.func == 'runSyncAcc')
	{
		console.log('runSyncAcc');
		setTimeout(doSyncAccountKeystrokes, 300);
		// doSyncAccountKeystrokes();
		return false;
	}
});

function openSettings(from)
{
	chrome.tabs.create({url: "pages/settings.html"+(from === 'install' ? '#firstrun' : '')});
}

if (chrome.runtime)
{
	// on install, open settings page
	chrome.runtime.onInstalled.addListener(function(details){
		if (details.reason == "install")
		{
			openSettings('install');
		}
		else if (details.reason == "update")
		{
			// update here
			openSettings();
		}
	});

	// open settings on extension icon click
	chrome.browserAction.onClicked.addListener(function(){
		openSettings();
	});
}

