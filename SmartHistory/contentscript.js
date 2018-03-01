// This is integrated inside each loaded page


// Event listener
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.message === 'GET_TAB_URL') 
    {
      sendResponse({ 
                url: getURL(),
             domain: getDomain()
      });
      console.log('Answered to GET_TAB_URL');
    }

    if (request.message === 'GET_TAB_OG_INFORMATION') 
    {
      sendResponse({
              title: getTitle(),
              image: getThumbnail(),
             domain: getDomain(),
        description: getDescription()
      });
      console.log('Answered to GET_TAB_OG_INFORMATION');
    }
  }
);

/**
 * Get the tab's URL. By default, we try to get the canonical OpenGraph URL, then we eventually fallback on the document.URL
 * @return string a URL
 */
function getURL() 
{
  var ogURL = document.querySelector("meta[property='og:url']");
  return  ogURL ? ogURL.getAttribute('content') : document.URL;
}

/**
 * og:title ==> h1 tag ==> h2 tag ==> title tag ==> url
 */
function getTitle() {
  var title = "";  
  var ogTitle =
    document.querySelector("meta[property='og:title']") ||
    document.querySelector("meta[property='twitter:title']");

  if (ogTitle) {
    title = ogTitle.getAttribute("content");
  }
  if (!title) {
    var titleTags = document.getElementsByTagName("title");
    title = graspText(titleTags);
  }
  if (!title) {
    var h1Tags = document.getElementsByTagName("h1");
    title = graspText(h1Tags);
  }
  if (!title) {
    var h2Tags = document.getElementsByTagName("h2");
    title = graspText(h2Tags);
  }

  return title ? title : getURL();
}

function getDomain() {
  return document.domain;
}

/**
 * og:description
 * ==> meta name="description"
 * ==> the first <p></p> tag
 */
function getDescription() {
  var description = "";
  var metaDesc =
    document.querySelector("meta[property='og:description']") ||
    document.querySelector("meta[property='twitter:description']") ||
    document.querySelector("meta[name='description']") ||
    document.querySelector("meta[name='Description']");
  
  if (metaDesc && metaDesc.getAttribute("content")) {
    description = metaDesc.getAttribute("content");
  }

  return description ? description : "No description found!";
}

/**
 * Get the text of the first node which contains
 * text in a node array
 */
function graspText(arr) 
{
  for (var i = 0; i < arr.length; i++) 
  {
    var text = getTextNode(arr[i]).replace(/[\r\n\s]+/g,"");
    if (text) 
      return getTextNode(arr[i]).replace(/[\r\n\s]+/g," ");
  }

  return "";
}

/**
 * Get all texts in the node |node|, include the texts
 * in his child nodes.
 */
function getTextNode(node) {
  var text = "";
  for (var i = 0; i < node.childNodes.length; i++) {
    if (node.childNodes[i].nodeName === "#text") {
      text = text.concat(node.childNodes[i].nodeValue);
    } else {
      text = text.concat(getTextNode(node.childNodes[i]));
    }
  }
  return text;
}

/**
 * Firstly, try to get the og:image information (address),
 * call chrome.tabs.captureVisibleTab in background.js if
 * failed. Because we can not access chrome extension API
 * from content script.
 */
function getThumbnail() 
{
  var ogPreview = document.querySelector("meta[property='og:image']");
  if (!ogPreview) 
    return "";

  return ogPreview.getAttribute("content");
}












