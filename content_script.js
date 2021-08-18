var cursorPosition,
	isKeystrokeSearchWindow = false,
	isRunningSnippetReplace = false,
	defaultSettingsObj = {
		settings: {
			is_default: true,
			insert_shortcut: 'ctrl+space',
			snippet_shortcut: 'tab',
			text_dir: 'ltr',
			new_joiner: 'on'
		}
	},
	settingsObj = defaultSettingsObj;

function isContentEditable(element)
{
	return element && element.hasAttribute('contenteditable');
}

function isEditable(element)
{
	return element && (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea' || isContentEditable(element));
}

function getCursorPosition(element)
{
	if (!element)
	{
		return false;
	}

	var doc = element.ownerDocument;
	var position = {
		element: element,
		offset: 0,
		/*absolute: {
			left: 0,
			top: 0
		},*/
		word: null
	};

	var getRanges = function(sel){
		if (sel.rangeCount)
		{
			var ranges = [];
			for (var i = 0; i < sel.rangeCount; i++)
			{
				ranges.push(sel.getRangeAt(i));
			}
			return ranges;
		}
		return [];
	};

	var restoreRanges = function(sel, ranges){
		for (var i in ranges)
		{
			sel.addRange(ranges[i]);
		}
	};

	if (isContentEditable(position.element))
	{
		// Working with editable div
		// Insert a virtual cursor, find its position
		// http://stackoverflow.com/questions/16580841/insert-text-at-caret-in-contenteditable-div

		var selection = doc.getSelection();
		console.log('SELECTION', selection);
		console.log('FOCUS NODE', selection.focusNode.data);
		// get the element that we are focused + plus the offset
		// Read more about this here: https://developer.mozilla.org/en-US/docs/Web/API/Selection.focusNode
		position.element = selection.focusNode;
		position.offset = selection.focusOffset;

		if ("https://www.facebook.com" !== window.location.origin || window.location.pathname.match(/^\/messages\//))
		{
			// First we get all ranges (most likely just 1 range)
			var ranges = getRanges(selection);
			var focusNode = selection.focusNode;
			var focusOffset = selection.focusOffset;

			if (!ranges.length)
			{
				// selection without any ranges
				return;
			}
			// remove any previous ranges
			selection.removeAllRanges();

			// Added a new range to place the caret at the focus point of the cursor
			var range = new Range();
			var caretText = '<span id="qt-caret"></span>';
			range.setStart(focusNode, focusOffset);
			range.setEnd(focusNode, focusOffset);
			range.insertNode(range.createContextualFragment(caretText));
			selection.addRange(range);
			selection.removeAllRanges();

			// finally we restore all the ranges that we had before
			restoreRanges(selection, ranges);
		}

	}
	// working with textarea or othr supported input types
	// https://html.spec.whatwg.org/multipage/forms.html#do-not-apply
	else if (position.element.tagName.toLowerCase() === 'textarea' || position.element.tagName.toLowerCase() === 'input' && ['', 'text', 'search', 'password', 'tel', 'url'].indexOf(position.element.tagName) !== -1)
	{
		position.start = position.element.selectionStart;
		position.end = position.element.selectionEnd;
	}
	// working with email fields or other fields that don't have selectionStart support
	// links:
	// http://stackoverflow.com/questions/21177489/selectionstart-selectionend-on-input-type-number-no-longer-allowed-in-chrome
	// https://html.spec.whatwg.org/multipage/forms.html#do-not-apply
	else
	{
		position.start = 0;
		position.end = 0;
	}
	console.log('Position: ', position);
	return position;
}

function clearElHTMLToText(htmlContent)
{
	var temp = $('<div id="keystroke-temp">').html(htmlContent);

	// replace links with plaintext
	temp.find('a').each(function(){
		var el = $(this);
		var href = el.attr('href');
		var text = el.text().trim();

		if (!href.length)
		{
			el.remove();
		}
		else if (!text.length)
		{
			el.replaceWith('<span>'+href+'</span>');
		}
		else
		{
			el.replaceWith('<span>'+text+(text != href ? ' ( '+href+' )' : '')+'</span>');
		}
	});

	temp.find('img').each(function(){
		var el = $(this);
		el.replaceWith('<span>'+el.attr('src')+'</span>');
	});

	$('body').append(temp);
	var txt = temp.text();
	temp.remove();

	txt = txt.replace(/(^\s*|\s*$|&nbsp;)/g, '');

	return txt;
}

function replaceWith(params)
{
	var doc = params.element.ownerDocument;
	var word = cursorPosition.word;

	var setText = function()
	{
		var parsedKeystroke = params.quicktext.content;

		// text keystrokes for facebook
		if ("https://www.facebook.com" === window.location.origin && !window.location.pathname.match(/^\/messages\//))
		{
			// replace links with plaintext
			parsedKeystroke = clearElHTMLToText(parsedKeystroke);

			var range = doc.createRange();
			var focusNode = params.focusNode;
			var selection = doc.getSelection();

			range.setStart(focusNode, word.start);
			range.setEnd(focusNode, word.end);

			if (word.text === params.quicktext.snip)
			{
				range.deleteContents();
			}

			var templTextNode = document.createTextNode(parsedKeystroke);
			range.insertNode(templTextNode);
			range.setStartAfter(templTextNode);
			range.collapse(true);
			selection.removeAllRanges();
			selection.addRange(range);
			templTextNode.parentNode.normalize();
			console.log(templTextNode.parentNode);
			return;
		}

		if (isContentEditable(params.element))
		{
			var selection = doc.getSelection();
			var range = doc.createRange();

			var focusNode = params.focusNode;
			if (focusNode === null)
			{
				focusNode = selection.focusNode;
			}

			// we need to have a text node in the end
			while (focusNode.nodeType === document.ELEMENT_NODE)
			{
				if (focusNode.childNodes.length > 0)
				{
					// select a text node
					focusNode = focusNode.childNodes[selection.focusOffset];
				}
				else
				{
					// create an empty text node and attach it before the node
					var tnode = doc.createTextNode('');
					// empty contenteditable, do not insert before it (fix gmail)
					if (focusNode == params.element && word.text == '' && word.start == 0 && word.end == 0)
					{
						focusNode.appendChild(tnode);
					}
					else
					{
						focusNode.parentNode.insertBefore(tnode, focusNode);
					}
					focusNode = tnode;
				}
			}

			// clear whitespace in the focused textnode
			if (focusNode.nodeValue)
			{
				focusNode.nodeValue = focusNode.nodeValue.trim();
			}

			// if snippet found then remove it otherwise skip it
			if (word.text === params.quicktext.snip)
			{
				range.setStart(focusNode, word.start);
				range.setEnd(focusNode, word.end);
				range.deleteContents();
			}
			else
			{
				range.setStart(focusNode, word.end);
				range.setEnd(focusNode, word.end);
			}

			var qtNode = range.createContextualFragment(parsedKeystroke);
			var lastQtChild = qtNode.lastChild;

			range.insertNode(qtNode);

			var caretRange = doc.createRange();
			caretRange.setStartAfter(lastQtChild);
			caretRange.collapse(true);
			selection.removeAllRanges();
			selection.addRange(caretRange);

			// set subject if gmail
			if ('https://mail.google.com' === window.location.origin && params.quicktext.subject)
			{
				$('input[name=subjectbox]:visible').val(params.quicktext.subject).attr('dir', settingsObj.settings.text_dir);
			}
		}
		else
		{
			var $textarea = $(params.element),
				value = $textarea.val();

			// this is needed to give the correct spaces
			// replace links with plaintext
			parsedKeystroke = clearElHTMLToText(parsedKeystroke);

			var valueNew = '';
			var cursorOffset = word.end + parsedKeystroke.length;

			// if the current word matches the shortcut then remove it
			// otherwise skip it (ex: from dialog)
			if (word.text === params.quicktext.snip)
			{
				valueNew = value.substr(0, word.start) + parsedKeystroke + value.substr(word.end);

				// decrease the cursor offset with the removed text length
				cursorOffset -= word.end - word.start;
			}
			else
			{
				// don't delete anything in the textarea
				// just add the qt
				valueNew = value.substr(0, word.end) + parsedKeystroke + value.substr(word.end);
			}

			$textarea.val(valueNew);

			// set focus at the end of the added qt
			$textarea[0].setSelectionRange(cursorOffset, cursorOffset);
		}
	};

	// we need the callback because the editor
	// doesn't get the focus right-away.
	// so window.getSelection() returns the search field
	// in the dialog otherwise, instead of the editor
	focusEditor(params.element, setText);
}

function focusEditor(element, callback)
{
	// return focus to the editor

	// gmail auto-focuses the to field
	// so we need the delay
	setTimeout(function(){
		if (element)
		{
			element.focus();
		}

		if (callback)
		{
			callback();
		}
	}, 50);
}

function getSelectedWord(params)
{
	var doc = params.element.ownerDocument;
	var word = {
		start: 0,
		end: 0,
		text: ''
	};

	var beforeSelection = "";
	var selection = doc.getSelection();
	if (isContentEditable(params.element))
	{
		switch (selection.focusNode.nodeType)
		{
			// In most cases, the focusNode property refers to a Text Node.
			case (document.TEXT_NODE): // for text nodes it's easy. Just take the text and find the closest word
				if ("https://www.facebook.com" === window.location.origin && !window.location.pathname.match(/^\/messages\//))
				{
					beforeSelection = selection.focusNode.textContent.substr(0, cursorPosition.offset);
				}
				else
				{
					beforeSelection = selection.focusNode.textContent;
				}
				break;
			// However, in some cases it may refer to an Element Node
			case (document.ELEMENT_NODE):
				// In that case, the focusOffset property returns the index in the childNodes collection of the focus node where the selection ends.
				if (selection.focusNode.childNodes.length) {
					beforeSelection = selection.focusNode.childNodes[selection.focusOffset].textContent;
				}
				break;
		}
	}
	else
	{
		beforeSelection = $(params.element).val().substr(0, cursorPosition.end);
	}

	if ("https://www.facebook.com" !== window.location.origin || window.location.pathname.match(/^\/messages\//))
	{
		// Replace all &nbsp; with normal spaces
		beforeSelection = beforeSelection.replace('\xa0', ' ').trim();
	}
	console.log('beforeSelection', beforeSelection);
	word.start = Math.max(beforeSelection.lastIndexOf(" "), beforeSelection.lastIndexOf("\n"), beforeSelection.lastIndexOf("<br>")) + 1;
	word.text = beforeSelection.substr(word.start);
	word.end = word.start + word.text.length;
	console.log('WORD: ', word);

	return word;
}

function snippetReplace(e)
{
	// do not run when search keystroke is active
	if (isKeystrokeSearchWindow)
	{
		return true;
	}

	isRunningSnippetReplace = true;

	var element = e.target;
	console.log('Target Element:', element);
	if (!isEditable(element))
	{
		return true;
	}
	var doc = element.ownerDocument,
		selection = doc.getSelection(),
		focusNode = selection.focusNode;

	if (selection.rangeCount)
	{
		var range = selection.getRangeAt(0);
		var caretPos = range.endOffset;
	}


	// First get the cursor position
	cursorPosition = getCursorPosition(element);
	console.log('cursorPosition:', cursorPosition);
	// Then get the word at the positon
	var word = getSelectedWord({element: element});
	cursorPosition.word = word;
	console.log(cursorPosition);
	if (!word.text)
	{
		return true;
	}

	// Find a matching snippet
	chrome.storage.local.get({keystrokes: [], keystrokes_shared: []}, function(res){
		var keystrokesMerged = res.keystrokes;

		if (res.keystrokes_shared.length)
		{
			for (var i = 0; i < res.keystrokes_shared.length; i++)
			{
				var obj = res.keystrokes_shared[i],
					isInKeystrokes = false;

				if (res.keystrokes.length)
				{
					for (var j = 0; j < res.keystrokes.length; j++)
					{
						var obj1 = res.keystrokes[j];

						if (obj.id == obj1.id)
						{
							isInKeystrokes = true;
							break;
						}
					}
					if (!isInKeystrokes)
					{
						keystrokesMerged.push(obj);
					}
				}
				else
				{
					keystrokesMerged.push(obj);
				}
			}
		}

		for (var i in keystrokesMerged)
		{
			var t = keystrokesMerged[i];
			if (t.snip === word.text)
			{
				console.log('Snippet found', t.content);
				e.preventDefault();
				e.stopPropagation();
				// replace with the snippet
				replaceWith({
					element: element,
					quicktext: {
						snip: t.snip,
						content: t.content,
						subject: t.subj
					},
					focusNode: focusNode
				});
				break;
			}
		}
	});

	isRunningSnippetReplace = false;
}

/**
 * adds a bindGlobal method to Mousetrap that allows you to
 * bind specific keyboard shortcuts that will still work
 * inside a text input field
 *
 * usage:
 * Mousetrap.bindGlobal('ctrl+s', _saveChanges);
 */
/* global Mousetrap:true */
(function(Mousetrap) {
	var _globalCallbacks = {};
	var _originalStopCallback = Mousetrap.prototype.stopCallback;

	Mousetrap.prototype.stopCallback = function(e, element, combo, sequence) {
		var self = this;

		if (self.paused) {
			return true;
		}

		if (_globalCallbacks[combo] || _globalCallbacks[sequence]) {
			return false;
		}

		return _originalStopCallback.call(self, e, element, combo);
	};

	Mousetrap.prototype.bindGlobal = function(keys, callback, action) {
		var self = this;
		self.bind(keys, callback, action);

		if (keys instanceof Array) {
			for (var i = 0; i < keys.length; i++) {
				_globalCallbacks[keys[i]] = true;
			}
			return;
		}

		_globalCallbacks[keys] = true;
	};

	Mousetrap.init();
})(Mousetrap);

function init()
{
	// load settings
	chrome.storage.local.get('settings', function(obj){
		if (!obj || !obj.settings)
		{
			obj = defaultSettingsObj;
		}

		settingsObj = obj;

		// set snippet replace event
		Mousetrap.bindGlobal(obj.settings.snippet_shortcut, snippetReplace);
		// set keystroke search event
		Mousetrap.bindGlobal(obj.settings.insert_shortcut, keystrokeSearchStart);
		console.log('Mousetrap Tab binded');
	});

	// set error handling
	// this code will be injected to run in webpage context
	function codeToInject()
	{
		window.addEventListener('error', function(e){
			console.log('CATCH ERROR', e);
			document.dispatchEvent(new CustomEvent('ReportError', {detail:e}));
		});
	}

	document.addEventListener('ReportError', function(e){
		console.log('CONTENT SCRIPT', e);
		if (isKeystrokeSearchWindow || isRunningSnippetReplace)
		{
			if (isKeystrokeSearchWindow)
			{
				closeKeystrokeSearch();
			}

			setTimeout(function(){
				alert('Oops! Extension might have been updated. Refresh the page to run updated version.');
			}, 50);
		}
	});

	// inject code
	var script = document.createElement('script');
	script.textContent = '(' + codeToInject + '())';
	(document.head||document.documentElement).appendChild(script);
	script.parentNode.removeChild(script);
}

RegExp.quote = function(str){
	return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

function runQuery(term, callback)
{
	var ret = [];
	
	chrome.storage.local.get({keystrokes: [], keystrokes_shared: []}, function(res){
		var keystrokesMerged = res.keystrokes;

		if (res.keystrokes_shared.length)
		{
			for (var i = 0; i < res.keystrokes_shared.length; i++) {
				var obj = res.keystrokes_shared[i],
					isInKeystrokes = false;

				if (res.keystrokes.length)
				{
					for (var j = 0; j < res.keystrokes.length; j++)
					{
						var obj1 = res.keystrokes[j];

						if (obj.id == obj1.id)
						{
							isInKeystrokes = true;
							break;
						}
					}
					if (!isInKeystrokes)
					{
						keystrokesMerged.push(obj);
					}
				}
				else
				{
					keystrokesMerged.push(obj);
				}
			}
		}

		if (!keystrokesMerged.length)
		{
			callback(ret);
			return;
		}

		// new first
		keystrokesMerged = keystrokesMerged.reverse();

		for (var i = 0; i < keystrokesMerged.length; i++)
		{
			var t = keystrokesMerged[i];
			t.weight = 0;

			if (term == '')
			{
				ret.push(t);
				continue;
			}

			var regex = new RegExp(RegExp.quote(term), 'gi');

			if (t.name.match(regex))
			{
				t.weight += 20*t.name.match(regex).length;
			}
			if (t.content.match(regex))
			{
				t.weight += 10*t.content.match(regex).length;
			}
			if (t.snip.match(regex))
			{
				t.weight += 5*t.snip.match(regex).length;
			}
			if (t.subj.match(regex))
			{
				t.weight += 1*t.subj.match(regex).length;
			}
			if (t.weight > 0)
			{
				ret.push(t);
			}
		}

		// return in reverse order - max weight first
		ret.sort(function(a, b){
			if (a.weight > b.weight)
			{
				return -1;
			}
			if (a.weight < b.weight)
			{
				return 1;
			}
			return 0;
		});

		// return 5 top results
		//ret = ret.slice(0, 4);
		// save data
		$('#messtempl_search_input').data('details', ret);

		callback(ret);
	});
}

function closeKeystrokeSearch()
{
	// turn on hotkeys
	Mousetrap.unpause();

	$('#messtempl_search_container').remove();
	$('.autocomplete-suggestions').remove();
	isKeystrokeSearchWindow = false;
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

function keystrokeSearchStart(e)
{
	e.preventDefault();
	e.stopPropagation();

	// stop hotkeys for search window
	Mousetrap.pause();

	var element = e.target;
	console.log('Target Element:', element);
	// if it's not an editable element
	// don't trigger anything
	if (!isEditable(element))
	{
		return false;
	}

	var doc = element.ownerDocument,
		selection = doc.getSelection(),
		focusNode = selection.focusNode;

	isKeystrokeSearchWindow = true;

	cursorPosition = getCursorPosition(element);
	// Then get the word at the positon
	cursorPosition.word = getSelectedWord({element: element});
	console.log('cursorPosition:', cursorPosition);

	$('body').prepend('\
	<div id="messtempl_search_container">\
		<div id="messtempl_search_overlay">\
			<input id="messtempl_search_input" placeholder="Start typing to search keystrokes" dir="'+settingsObj.settings.text_dir+'">\
		</div>\
	</div>');

	$('#messtempl_search_container').on('click', function(e){
		if (e.target.id == $(this).attr('id'))
		{
			closeKeystrokeSearch();
		}
	});

	$('#messtempl_search_input').autoComplete({
		minChars: 0,
		source: function(term, callback){
			runQuery(term, callback);
		},
		delay: 300,
		cache: false,
		renderItem: function (item, search){
			//$('#messtempl_search_overlay').css('height', '240px');
			search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
			var re = new RegExp("(" + search.split(' ').join('|') + ")", "gi");
			return '<div class="autocomplete-suggestion" data-id="'+item.id+'" dir="'+settingsObj.settings.text_dir+'">'+escapeHtml(item.name).replace(re, "<b>$1</b>")+(item.snip ? '<div class="snip">'+escapeHtml(item.snip)+'</div>' : '')+'</div>';
		},
		onSelect: function(e, term, item){

			e.preventDefault();
			e.stopPropagation();

			var details = $('#messtempl_search_input').data('details'),
				selectedDetails = [];
			for (var i = 0; i < details.length; i++)
			{
				if (details[i].id == item.attr('data-id'))
				{
					selectedDetails = details[i];
					break;
				}
			}

			replaceWith({
				element: element,
				quicktext: {
					snip: selectedDetails.snip,
					content: selectedDetails.content,
					subject: selectedDetails.subj
				},
				focusNode: focusNode
			});

			closeKeystrokeSearch();
		}
	}).focus();

	// Mousetrap.bindGlobal('esc', closeKeystrokeSearch);
	$(document).keyup(function(e){
		if (e.keyCode == 27)
		{
			if (isKeystrokeSearchWindow)
			{
				closeKeystrokeSearch();

				e.preventDefault();
				e.stopPropagation();

				return false;
			}
		}
	});
}

function isSiteInterfaceLoaded()
{
	return (window.location.origin != 'https://mail.google.com' || $('div[role=main]:first').length > 0);
}

function setLoadCallback(callback)
{
	// wait until the gmail interface has finished loading
	if (isSiteInterfaceLoaded())
	{
		return callback();
	}
	var load_count = 0;
	var delay = 200; // 200ms per check
	var attempts = 50; // try 50 times before giving up & assuming an error
	var timer = setInterval(function(){
		if (isSiteInterfaceLoaded())
		{
			clearInterval(timer);
			return callback();
		}

		// if count limit, will automatically fire event in 5 further seconds
		if (++load_count > attempts)
		{
			clearInterval(timer);
			setTimeout(callback, 5000);
		}
	}, delay);
	return true;
}

setLoadCallback(init);