var googleScriptBaseUrl = '#',
	screens = $('.screen'),
	templcreen = $('#screen_templ'),
	settscreen = $('#screen_settings'),
	loadingDiv = $('#loading-spinner'),
	newTemplBtn = $('#new_templ_btn'),
	resyncSharedBtn = $('#resync_shared'),
	delSelectedBtn = $('#del_selected_btn'),
	saveTemplBtn = $('#save_keystroke'),
	saveCancelBtn = $('#save_cancel'),
	modaWndOverlay = $('#overlay-container'),
	newTemplWnd = $('#new_keystroke_overlay'),
	shareTemplWnd = $('#share_overlay'),
	shareWithEmail = $('#share_with_email'),
	sharedTo = $('#shared_to'),
	sharedList = $('#shared_list'),
	notLoggedInText = shareTemplWnd.find('.share_not_logged_in'),
	notLoggedInBtn = shareTemplWnd.find('.share_open_login'),
	sendBtn = $('#share_keystroke'),
	shareCancelBtn = $('#share_cancel'),
	//allWnd = modaWndOverlay.find('.page'),
	editorEl = $('#templ_content'),
	screenLinks = {
		all: $('#templ_all'),
		shared: $('#templ_shared'),
		settings: $('#settings')
	},
	
	KEYSTROKES_LIST = [],
	SHARED_KEYSTROKES_LIST = [],
	defaultSettingsObj = {
		settings: {
			is_default: true,
			insert_shortcut: 'ctrl+space',
			snippet_shortcut: 'ctrl',
			text_dir: 'ltr',
			new_joiner: 'off'
		}
	},
	settingsObj = defaultSettingsObj;
let isImported,okImperted,sImperted;


if (!$.highlight)
{
	(function($){
		// has to be in this format since we use rgba
		var color = '251, 250, 211';

		$.fn.highlight = function(){
			var opacity = 100,
				el = this;
			var interval = setInterval(function(){
				opacity -= 3;
				if (opacity <= 0)
				{
					clearInterval(interval);
					el.css({background: ''});

					// fix for links with background
					el.find('.morelink').css('background', '');
				}
				else
				{
					el.css({background: "rgba("+color+", "+opacity/100+")"});

					// fix for links with background
					el.find('.morelink').css('background', 'none');
				}
			}, 50);

			return this;
		};
	})(jQuery);
}

function escapeHtml(string)
{
	var entityMap = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': '&quot;',
		"'": '&#39;',
		"/": '&#x2F;'
	};
	return String(string).replace(/[&<>"'\/]/g, function (s) {
		return entityMap[s];
	});
}

function isValidEmail(email)
{
	var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

	return re.test(email);
}

function showSharedToList(data, highlightLast)
{
	if (!data.length)
	{
		return;
	}
	shareWithEmail.val('');
	sharedList.html('');
	for (var i = 0; i < data.length; i++)
	{
		sharedList.append('<li>'+data[i]+' <span class="unshare" title="Remove shared keystroke for '+data[i]+'" data-email="'+data[i]+'"></span></li>');
	}

	sharedList.find('.unshare').on('click', function(){

		var el = $(this),
			email = el.attr('data-email');

		if (!confirm('Do you really want to deny '+email+' access to this keystroke?'))
		{
			return;
		}

		var id = $('#share_templ_id').val();
		var loadingEl = shareTemplWnd.find('.loading_wrap');


		shareWithEmail.addClass('hidden').val('');
		sendBtn.addClass('hidden');
		shareCancelBtn.addClass('hidden');
		notLoggedInText.addClass('hidden');
		notLoggedInBtn.addClass('hidden');
		sharedTo.addClass('hidden');
		sharedList.html('').addClass('hidden');
		loadingEl.removeClass('hidden');

		$.ajax({
			type: 'GET',
			url: googleScriptBaseUrl,
			data: {f: 'remove_shared', tid: id, e: email},
			cache: false,
			success: function(data, status, xhr){
				loadingEl.addClass('hidden');

				var contentType = xhr.getResponseHeader("content-type") || "";
				// if no json, then not logged in
				if (contentType.indexOf('json') == -1)
				{
					notLoggedInText.removeClass('hidden');
					notLoggedInBtn.attr('href', googleScriptBaseUrl+'?f=login').removeClass('hidden');
				}
				else
				{
					shareWithEmail.removeClass('hidden').focus();
					sendBtn.removeClass('hidden');
					shareCancelBtn.removeClass('hidden');
					notLoggedInText.addClass('hidden');
					notLoggedInBtn.addClass('hidden');

					showSharedToList(data, false);
				}
			},
			error: function(xhr, status){
				alert('Error occured! Please try again later');
			}
		});
	});

	sharedTo.removeClass('hidden');
	sharedList.removeClass('hidden');

	if (highlightLast)
	{
		sharedList.find('li').last().highlight();
	}
}

function keystrokesScreen(screen, selectedId)
{
	templcreen.removeClass('hidden').find('.notfound').addClass('hidden');

	if (screen == 'shared')
	{
		templcreen.find('.all_specific').addClass('hidden');
		templcreen.find('.shared_specific').removeClass('hidden');
	}
	else
	{
		templcreen.find('.all_specific').removeClass('hidden');
		templcreen.find('.shared_specific').addClass('hidden');

		var hash = window.location.hash.substring(1);

		if (hash == 'firstrun')
		{
			$('#first_run_notice').removeClass('hidden').css('display', 'none').fadeIn().on('click', function(){$(this).fadeOut()});
		}
	}

	var keystrokeCallback = function(){
		return function(keystrokesArr){
			loadingDiv.addClass('hidden');

			var notFound = templcreen.find('.notfound').first(),
				contentDiv = templcreen.find('.content').first();

			contentDiv.removeClass('hidden');

			if (keystrokesArr == null || keystrokesArr.length == 0)
			{
				// clear keystroke list
				contentDiv.html('');
				notFound.removeClass('hidden');
				return;
			}

			var contentHTML = '<table>';
			var sanitizeInstanse = new Sanitize(Sanitize.Config.RELAXED);
			for (var i = 0; i < keystrokesArr.length; i++)
			{
				var keystroke = keystrokesArr[i],
					tempNode = document.createElement('div');
				tempNode.innerHTML = keystroke.content;
				var contentEscaped = sanitizeInstanse.clean_node(tempNode);

				// make new element, insert document fragment, then get innerHTML
				var divTmp = document.createElement('div');
				divTmp.appendChild(contentEscaped);
				contentEscaped = divTmp.innerHTML;

				console.log(keystroke);
				
				contentHTML += '\
					<tr class="templ_body '+(screen == 'shared' ? 'shared' : '')+'" data-id="'+keystroke.id+'">\
						<td class="sel_td">'+(screen == 'shared' ? '' : '<input type="checkbox">')+'</td>\
						<td class="name_td" '+(screen == 'shared' ? '' : 'title="Click to edit"')+'><span class="name">'+escapeHtml(keystroke.name)+'</span><br>\
							'+(keystroke.snip ? '<span class="snip">'+escapeHtml(keystroke.snip)+'</span>' : '')+
							(keystroke.shared_by ? '<p class="shared_by">Shared by '+escapeHtml(keystroke.shared_by)+'</p>' : '')+'\
						</td>\
						<td class="content_td"><div '+(screen == 'shared' ? '' : 'title="Click to edit"')+'>'+contentEscaped+'</div></td>\
						<td class="butt_td">\
						'+(screen == 'shared' ? '' : '<a href="javascript:void(0)" class="share_templ btn" data-id="'+keystroke.id+'">Share</a>\
							<a href="javascript:void(0)" class="delete_templ btn">Delete</a>')+'\
						</td>\
					</tr>';
			}
			contentHTML += '</table>';

			contentDiv.html(contentHTML);

			// highlight selected keystroke
			if (selectedId)
			{
				contentDiv.find('tr[data-id="'+selectedId+'"]').highlight();
			}

			var contentHeight = 45;

			// add Show more links
			$('.content_td > div').each(function(){
				var el = $(this);
				
				if (el.height() > 70)
				{
					el.css({'height': contentHeight, 'overflow': 'hidden'});
					el.parent().append('<a class="morelink less" href="#">Show more</a>');
				}
			});

			$('.morelink').click(function(e){
				e.preventDefault();

				var link = $(this);
				if (link.hasClass('less'))
				{
					link.text('Show less').removeClass('less');
					link.prev('div').css('height', 'auto');
				}
				else
				{
					link.text('Show more').addClass('less');
					link.prev('div').css('height', contentHeight);
				}
			});

			// if shared screen, do nothing with events
			if (screen == 'shared')
			{
				return;
			}

			// add evemt listeners
			contentDiv.find('td.name_td, td.content_td > div').on('click', function(e){
				e.preventDefault();
				e.stopPropagation();

				var el = $(this),
					id = el.closest('tr').attr('data-id'),
					templData = null;

				// find keystroke
				for (var i = 0; i < KEYSTROKES_LIST.length; i++) {
					var keystroke = KEYSTROKES_LIST[i];

					if (keystroke.id == id)
					{
						templData = keystroke;
						break;
					}
				}

				if (templData == null)
				{
					alert('Keystroke not found!');
					return;
				}

				newTemplWnd.find('.edit_templ_header').removeClass('hidden');
				newTemplWnd.find('.new_templ_header').addClass('hidden');
				// set values
				$('#templ_id').val(id);
				$('#synced_timestamp').val(templData.synced_timestamp);
				$('#name').val(templData.name);
				$('#snip').val(templData.snip);
				$('#subj').val(templData.subj);

				tinyMCE.activeEditor.setContent(templData.content);
				// show modal window
				modaWndOverlay.removeClass('hidden');
				newTemplWnd.removeClass('hidden');

			});

			// set share keystroke events
			contentDiv.find('.share_templ').on('click', function(e){
				e.preventDefault();

				// TODO TEMPORARY! remove this line!
				// return;

				var id = $(this).closest('tr').attr('data-id'),
					templData = null;

				// find keystroke
				for (var i = 0; i < KEYSTROKES_LIST.length; i++)
				{
					var keystroke = KEYSTROKES_LIST[i];

					if (keystroke.id == id)
					{
						templData = keystroke;
						break;
					}
				}

				if (templData == null)
				{
					alert('Keystroke not found!');
					return;
				}

				var loadingEl = shareTemplWnd.find('.loading_wrap');

				shareWithEmail.addClass('hidden').val('');
				sendBtn.addClass('hidden');
				shareCancelBtn.addClass('hidden');
				notLoggedInText.addClass('hidden');
				notLoggedInBtn.addClass('hidden');
				sharedTo.addClass('hidden');
				sharedList.html('').addClass('hidden');
				loadingEl.removeClass('hidden');

				$('#share_templ_id').val(id);
				shareTemplWnd.find('b').text(templData.name);

				// show modal window
				modaWndOverlay.removeClass('hidden');
				shareTemplWnd.removeClass('hidden');

				// check if logged in and can share
				$.ajax({
					type: 'GET',
					url: googleScriptBaseUrl,
					data: {f: 'check', tid: id},
					cache: false,
					success: function(data, status, xhr){
						loadingEl.addClass('hidden');

						var contentType = xhr.getResponseHeader("content-type") || "";
						// if no json, then not logged in
						if (contentType.indexOf('json') == -1)
						{
							notLoggedInText.removeClass('hidden');
							notLoggedInBtn.attr('href', googleScriptBaseUrl+'?f=login').removeClass('hidden');
						}
						else
						{
							shareWithEmail.removeClass('hidden').focus();
							sendBtn.removeClass('hidden');
							shareCancelBtn.removeClass('hidden');
							notLoggedInText.addClass('hidden');
							notLoggedInBtn.addClass('hidden');

							showSharedToList(data, false);
						}
					},
					error: function(xhr, status){
						alert('Error occured! Please try again later');
					}
				});
			});

			// set delete keystroke events
			contentDiv.find('.delete_templ').on('click', function(e){
				e.preventDefault();
				if (!confirm('Do you really want to delete this keystroke?'))
				{
					return;
				}
				var id = $(this).closest('tr').attr('data-id'),
					delIds = [];

				delIds.push(id);
				deleteKeystrokesArr(delIds);
			});

			// set delete selected event
			contentDiv.find('.sel_td input').on('change', function(){
				if (contentDiv.find('.sel_td input:checked').length > 0)
				{
					delSelectedBtn.removeClass('hidden');
				}
				else
				{
					delSelectedBtn.addClass('hidden');
				}
			});
		};
	}(screen, selectedId);

	loadFromStorage(keystrokeCallback, screen);
}

function deleteKeystrokesArr(delIdsArr)
{
	if (delIdsArr == null || delIdsArr.length == 0)
	{
		return;
	}
	for (var i = 0; i < KEYSTROKES_LIST.length; i++)
	{
		// if keystroke id in delete list
		if (delIdsArr.indexOf(KEYSTROKES_LIST[i].id) !== -1)
		{
			var delId = KEYSTROKES_LIST[i].id;
			KEYSTROKES_LIST.splice(i, 1);
			// decrement because indexes are recalculated after splice
			i--;

			var params = {
				f: 'save',
				t: JSON.stringify({id: delId, is_deleted: true})
			};

			// save to permanent storage
			// $.ajax({
			// 	type: 'POST',
			// 	url: googleScriptBaseUrl,
			// 	data: params,
			// 	cache: false,
			// 	// do nothing
			// 	success: function(data, status, xhr){},
			// 	error: function(xhr, status){
			// 		//alert('Error occured! Please try again later');
			// 	}
			// });

		}
	}

	saveKeystrokesToStorage(KEYSTROKES_LIST);
}

function settingsScreen()
{
	settscreen.removeClass('hidden');
	loadingDiv.addClass('hidden');

	var warnDiv = settscreen.find('.warn').first(),
		resetBtn = $('#reset_settings');
	warnDiv.addClass('hidden');

	resetBtn.off('click').on('click', function(){
		if (!confirm('Do you really want to reset settings to defaults?'))
		{
			return;
		}
		// load settings default
		chrome.storage.local.get('settings', function(obj){
			if (!obj || !obj.settings)
			{
				obj = defaultSettingsObj;
			}

			obj.settings.is_default = true;
			obj.settings.insert_shortcut = 'ctrl+space';
			obj.settings.snippet_shortcut = 'tab';
			obj.settings.text_dir = 'ltr';
			obj.settings.new_joiner = 'off';

			chrome.storage.local.set({'settings': obj.settings}, function(){
				resetBtn.addClass('hidden');
				warnDiv.first().removeClass('hidden').css('display', 'none').fadeIn();
				handleHashChange();
			});
		});
	});

	// load settings
	chrome.storage.local.get('settings', function(obj){
		if (!obj || !obj.settings)
		{
			obj = defaultSettingsObj;
		}

		if (!obj.settings.is_default)
		{
			resetBtn.removeClass('hidden');
		}

		// show settings on page
		$('#shortcut_field')
			.val(obj.settings.insert_shortcut)
			.attr('data-prev_val', obj.settings.insert_shortcut)
			.attr('data-settings_key', 'insert_shortcut')
			.off('click').on('click', function(){
				recordSequence($(this));
			});
		$('#snippet_field')
			.val(obj.settings.snippet_shortcut)
			.attr('data-prev_val', obj.settings.snippet_shortcut)
			.attr('data-settings_key', 'snippet_shortcut')
			.off('click').on('click', function(){
				recordSequence($(this));
			});
		$('#text_dir').val(obj.settings.text_dir).on('change', function(){
			var newValue = $(this).val();
			chrome.storage.local.get('settings', function(obj){
				if (!obj || !obj.settings)
				{
					obj = defaultSettingsObj;
				}
				obj.settings.text_dir = newValue;
				obj.settings.is_default = false;
				chrome.storage.local.set({'settings': obj.settings}, function(){
					warnDiv.first().removeClass('hidden').css('display', 'none').fadeIn();
					resetBtn.removeClass('hidden');
				});
			});
		});
		// code for new joiner setting
		$('#new_joiner').val(obj.settings.new_joiner).on('change', function(){
			var newValue = $(this).val();
			chrome.storage.local.get('settings', function(obj){
				if (!obj || !obj.settings)
				{
					obj = defaultSettingsObj;
				}
				obj.settings.new_joiner = newValue;
				obj.settings.is_default = false;
				chrome.storage.local.set({'settings': obj.settings}, function(){
					warnDiv.first().removeClass('hidden').css('display', 'none').fadeIn();
					resetBtn.removeClass('hidden');
				});
				console.log(newValue);
			});
			// chrome.storage.local.get(obj.settings.text_dir, function(newjoiner){
			// 	console.log(newjoiner);
		
			// 	});
		});
	});
	

	var recordSequence = function(el){
		el.val('').attr('data-record_active', true).on('blur', function(){
			$(this).attr('data-record_active', false).val($(this).attr('data-prev_val'));
		});

		var settingsKey = el.attr('data-settings_key');

		Mousetrap.record(function(sequence){
			if (el.attr('data-record_active') == 'false')
			{
				return;
			}

			// sequence is an array like ['ctrl+k', 'c']
			var val = sequence.join(' ');
			el.val(val).attr('data-prev_val', val).blur();

			chrome.storage.local.get('settings', function(obj){
				if (!obj || !obj.settings)
				{
					obj = defaultSettingsObj;
				}
				obj.settings[settingsKey] = val;
				obj.settings.is_default = false;
				chrome.storage.local.set({'settings': obj.settings}, function(){
					warnDiv.first().removeClass('hidden').css('display', 'none').fadeIn();
					resetBtn.removeClass('hidden');
				});
			});
		});
	};

}

function hideScreens()
{
	screens.addClass('hidden');
	loadingDiv.removeClass('hidden');
	delSelectedBtn.addClass('hidden');
	$('.close-button').click();
}

function initTinyMCE()
{
	// trick to init tinymce on hidden textarea
	editorEl.css({
		width: editorEl.width(),
		height: editorEl.height()
	});

	tinymce.init({
		selector: '#templ_content',
		// don't wrap text in <p>
		forced_root_block: 'div',
		menubar: false,
		statusbar: false,
		style_formats: [
			{title: 'Small', inline: 'span', styles: {'font-size': '10px'}},
			{title: 'Normal', inline: 'span', styles: {'font-size': '14px'}},
			{title: 'Large', inline: 'span', styles: {'font-size': '18px'}},
			{title: 'Huge', inline: 'span', styles: {'font-size': '24px'}}
		],
		toolbar: 'undo redo | styleselect | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist | link image | ltr rtl',
		plugins : 'directionality autolink link image lists',
		link_assume_external_targets: true,
		target_list: false,
		link_title: false,
		height: 240,
		body_id: 'templ_content_editor',
		content_css : 'style.css'
	}).then(function(editors){
		//handleTextDirection();
	});
}

function handleHashChange()
{
	// on screen change resync acc keystrokes
	console.log('Hash change SYNC runSyncAcc');
	chrome.runtime.sendMessage({func: 'runSyncAcc'});

	hideScreens();
	
	var hashParts = window.location.hash.substring(1).split('/'),
		hash = hashParts[0],
		id = hashParts[1];

	$.each(screenLinks, function(key, val){
		val.removeClass('selected');
	});

	if (hash == 'settings')
	{
		screenLinks.settings.addClass('selected');
		settingsScreen();
	}
	else if (hash == 'shared')
	{
		screenLinks.shared.addClass('selected');
		keystrokesScreen('shared', id);
	}
	else
	{
		screenLinks.all.addClass('selected');
		keystrokesScreen();
	}
}

function generateUniqueId()
{
	return Date.now()+'-'+Math.random().toString(16);
}

function loadSettings()
{
	// load settings
	chrome.storage.local.get('settings', function(obj){
		if (!obj || !obj.settings)
		{
			obj = defaultSettingsObj;
		}

		settingsObj = obj;

		templcreen.attr('dir', settingsObj.settings.text_dir);
		$('input,textarea').attr('dir', settingsObj.settings.text_dir);
	});
}

function loadSettings()
{
	// load settings
	chrome.storage.local.get('settings', function(obj){
		if (!obj || !obj.settings)
		{
			obj = defaultSettingsObj;
		}

		settingsObj = obj;

		templcreen.attr('newJoiner', settingsObj.settings.new_joiner);
		$('input,textarea').attr('newjoiner', settingsObj.settings.new_joiner);
	});
}

function startApp()
{
	loadSettings();
	initTinyMCE();

	// import start
	
		resyncSharedBtn.on('click', function(e){
		e.preventDefault();
		
		ks.forEach(element => {

		var v = {
			
		//	id: $('#templ_id').val() || generateUniqueId(),
			id:element.id,
			synced_timestamp: $('#synced_timestamp').val(),
			name: element.name,
			snip: element.snip,
			subj: element.subj,
			content: element.content,
		};
	
		if (v.name == '')
		{
			alert('Please fill Keystroke Name!');
			return;
		}
		else if (v.content == '')
		{
			alert('Please fill Keystroke Content!');
			return;
		}
	
		var storageData = jQuery.extend(true, {}, v);
		storageData.content = Base64.encode(storageData.content);
	
		var params = {
			f: 'save',
			t: JSON.stringify(storageData)
		};	
	
		var edited = false;
		for (var i = 0; i < KEYSTROKES_LIST.length; i++)
		{
			if (KEYSTROKES_LIST[i].id == v.id)
			{
				KEYSTROKES_LIST[i] = v;
				edited = true;
				break;
			}
		}
		if (!edited)
		{
			// save in right order, on load list was reversed!
			KEYSTROKES_LIST.unshift(v);
		}
	});
		saveKeystrokesToStorage(KEYSTROKES_LIST);		
		});

	
	//  import end



	newTemplBtn.on('click', function(e){
		e.preventDefault();

		newTemplWnd.find('.new_templ_header').removeClass('hidden');
		newTemplWnd.find('.edit_templ_header').addClass('hidden');
		// set default values
		$('#templ_id').val('');
		$('#synced_timestamp').val('');
		$('#name').val('');
		$('#snip').val('');
		$('#subj').val('');

		tinyMCE.activeEditor.setContent('');
		// set editor text direction
		$(tinymce.activeEditor.getBody()).children().attr('dir', settingsObj.settings.text_dir);

		// show modal window
		modaWndOverlay.removeClass('hidden');
		newTemplWnd.removeClass('hidden');
	});

	// save keystroke
	saveTemplBtn.on('click', function(e){
		e.preventDefault();

		var v = {
			id: $('#templ_id').val() || generateUniqueId(),
			synced_timestamp: $('#synced_timestamp').val(),
			name: $('#name').val(),
			snip: $('#snip').val(),
			subj: $('#subj').val(),
			content: tinyMCE.activeEditor.getContent().trim()
		};

		if (v.name == '')
		{
			alert('Please fill Keystroke Name!');
			return;
		}
		else if (v.content == '')
		{
			alert('Please fill Keystroke Content!');
			return;
		}

		var storageData = jQuery.extend(true, {}, v);
		storageData.content = Base64.encode(storageData.content);

		var params = {
			f: 'save',
			t: JSON.stringify(storageData)
		};

		// save to permanent storage
		// $.ajax({
		// 	type: 'POST',
		// 	url: googleScriptBaseUrl,
		// 	data: params,
		// 	cache: false,
		// 	// do nothing
		// 	success: function(data, status, xhr){
		// 		var contentType = xhr.getResponseHeader("content-type") || "";
		// 		// if no json, then not logged in
		// 		if (contentType.indexOf('json') == -1)
		// 		{
		// 			return;
		// 		}
		//
		// 		if (data.error)
		// 		{
		// 			chrome.runtime.sendMessage({func: 'runSyncAcc'});
		// 			console.log('Keystroke save SYNC runSyncAcc');
		// 			if (data.was_deleted)
		// 			{
		// 				alert('Save error! Keystroke was previously removed from your account. Refresh the page to view updated keystrokes.');
		// 			}
		// 			else
		// 			{
		// 				alert('Save error! Keystroke was previously changed from another computer. Refresh the page to view updated version.');
		// 			}
		// 		}
		// 	},
		// 	error: function(xhr, status){
		// 		//alert('Error occured! Please try again later');
		// 	}
		// });

		var edited = false;
		for (var i = 0; i < KEYSTROKES_LIST.length; i++)
		{
			if (KEYSTROKES_LIST[i].id == v.id)
			{
				KEYSTROKES_LIST[i] = v;
				edited = true;
				break;
			}
		}
		if (!edited)
		{
			// save in right order, on load list was reversed!
			KEYSTROKES_LIST.unshift(v);
		}

		saveKeystrokesToStorage(KEYSTROKES_LIST);
	});



	saveCancelBtn.on('click', function(e){
		$('.close-button').click();
	});
	shareCancelBtn.on('click', function(e){
		$('.close-button').click();
	});

	$('.close-button').on('click', function(){
		// close modal window
		$(this).parent('.page').addClass('hidden').parent().addClass('hidden');
	});

	// delete selected keystrokes
	delSelectedBtn.on('click', function(){
		var contentDiv = templcreen.find('.content').first(),
			checkboxesChecked = contentDiv.find('.sel_td input:checked');

		if (checkboxesChecked.length == 0)
		{
			return;
		}

		if (!confirm('Do you really want to delete '+checkboxesChecked.length+' selected keystroke'+(checkboxesChecked.length == 1 ? '' : 's')+'?'))
		{
			return;
		}

		var delIds = [];
		checkboxesChecked.each(function(){
			var el = $(this),
				id = el.closest('tr').attr('data-id');
			console.log('Del id: '+id);
			delIds.push(id);
		});
		deleteKeystrokesArr(delIds);
	});

	// send keystroke (share window)
	sendBtn.on('click', function(e){
		e.preventDefault();

		var id = $('#share_templ_id').val(),
			templData = null;

		// find keystroke
		for (var i = 0; i < KEYSTROKES_LIST.length; i++)
		{
			var keystroke = KEYSTROKES_LIST[i];
			console.log(id, keystroke);
			if (keystroke.id == id)
			{
				templData = jQuery.extend(true, {}, keystroke);
				break;
			}
		}

		if (templData == null)
		{
			alert('Keystroke not found!');
			return;
		}

		var email = shareWithEmail.val(),
			loadingEl = shareTemplWnd.find('.loading_wrap');

		if (!isValidEmail(email))
		{
			alert('Looks like email you have entered has typo, please check it and try to send again');
			return;
		}

		templData.content = Base64.encode(templData.content);

		var params = {
			f: 'share',
			t: JSON.stringify(templData),
			w: email
		};

		loadingEl.removeClass('hidden');

		// share request
		$.ajax({
			type: 'POST',
			url: googleScriptBaseUrl,
			data: params,
			cache: false,
			success: function(data, status, xhr){
				loadingEl.addClass('hidden');

				var contentType = xhr.getResponseHeader("content-type") || "";
				// if no json, then not logged in
				if (contentType.indexOf('json') == -1)
				{
					console.log(data);
					if (data.match('error'))
					{
						alert('Error occured! Please try again later');
					}
					else
					{
						sharedTo.addClass('hidden');
						sharedList.addClass('hidden');
						shareWithEmail.addClass('hidden');
						sendBtn.addClass('hidden');
						shareCancelBtn.addClass('hidden');

						notLoggedInText.removeClass('hidden');
						notLoggedInBtn.attr('href', googleScriptBaseUrl+'?f=login').removeClass('hidden');
					}
				}
				else
				{
					shareWithEmail.removeClass('hidden').focus();
					sendBtn.removeClass('hidden');
					shareCancelBtn.removeClass('hidden');
					notLoggedInText.addClass('hidden');
					notLoggedInBtn.addClass('hidden');

					showSharedToList(data, true);
				}
			},
			error: function(xhr, status){
				alert('Error occured! Please try again later');
			}
		});
	});

	// search for keystrokes
	$('#search').on('input', function(){
		var search = $(this).val().trim().toLowerCase(),
			templTr = $('.templ_body'),
			notFound = templcreen.find('.notfound').first();

		// if no keystrokes
		if (!templTr.length)
		{
			return;
		}

		// if empty search
		if (search == '')
		{
			templTr.removeClass('hidden');
			return;
		}

		var shownTr = templTr.filter(function(){
			var tr = $(this),
				name = tr.find('.name_td').text().toLowerCase(),
				content = tr.find('.content_td').text().toLowerCase();

			if (name.match(search) || content.match(search))
			{
				tr.removeClass('hidden');
				return true;
			}

			tr.addClass('hidden');
			return false;
		});

		if (shownTr.length)
		{
			notFound.addClass('hidden');
		}
		else
		{
			notFound.removeClass('hidden');
		}

	}).focus();

	// add listener for login
	chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
		if (message.login_successful)
		{
			shareWithEmail.removeClass('hidden').focus();
			sendBtn.removeClass('hidden');
			shareCancelBtn.removeClass('hidden');
			notLoggedInText.addClass('hidden');
			notLoggedInBtn.addClass('hidden');
			sharedTo.removeClass('hidden');
			sharedList.removeClass('hidden');

			// doSyncAccountKeystrokes();
			//
			// syncAccInterval = setInterval(doSyncAccountKeystrokes, syncAccIntervalTime);
		}
	});

	$(window).on('hashchange', function() {
		handleHashChange();
	});
	
	handleHashChange();
}


$(document).ready(function(){
	startApp();
	console.log('App start SYNC runSyncAcc');
	chrome.runtime.sendMessage({func: 'runSyncAcc'});
});

function loadFromStorage(callback, screen)
{
	if (screen == 'shared')
	{
		chrome.storage.local.get({'keystrokes_shared': []}, function(obj){
			SHARED_KEYSTROKES_LIST = obj.keystrokes_shared;
			callback(SHARED_KEYSTROKES_LIST);
		});
	}
	else
	{
		chrome.storage.local.get('keystrokes', function(obj){
			KEYSTROKES_LIST = [];
			if (obj && obj.keystrokes && obj.keystrokes.length)
			{
				// new first
				KEYSTROKES_LIST = obj.keystrokes.reverse();
			}
			callback(KEYSTROKES_LIST);
		});
	}
}

function saveKeystrokesToStorage(templArr)
{
	console.log(templArr);
	// save in right order, on load list was reversed!
	templArr = templArr.reverse();
	chrome.storage.local.set({'keystrokes': templArr}, function(){
		window.location.hash = '#all';
		handleHashChange();
	});
}