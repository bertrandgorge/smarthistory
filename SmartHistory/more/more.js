/*
 * 'more' page of SmartHistory
 *
 */

var FB_SHARE_LINK = 'https://www.facebook.com/sharer/sharer.php?u=';
var TW_SHARE_LINK = 'https://twitter.com/intent/tweet?url=';
var YM_SHARE_LINK = 'https://www.yammer.com/home/bookmarklet?bookmarklet_pop=1&u=';

document.addEventListener("DOMContentLoaded", function(event)
{
  // Load all recent pages from IndexedDB and then feed them to the dom using KnockOut (ko)
  var objContainer = [];

  var ViewModel = function(arr) {
    this.itemsArr = ko.observableArray(arr);
  };

  var requestOpen = window.indexedDB.open('SmartHistory', 1);
  requestOpen.onerror = function(event) { console.log('Error opening DB'); };
  
  requestOpen.onsuccess = function(event) 
  {
    var db = event.target.result;
    var objectStoreImages = db.transaction(['OpenGraph']).objectStore('OpenGraph');
    objectStoreImages.openCursor().onsuccess = function(event) 
    {
      var cursor = event.target.result;
      if (cursor)
      {
        // Retrieve data from the 'OpenGraph' object store
        var objModel = {
          hash: cursor.key,
          title: cursor.value.title,
          description: cursor.value.description,
          image: cursor.value.image
        };
        // Retrieve data from 'URLs' object store
        var objectStoreURLs = db.transaction(['URLs']).objectStore('URLs');
        objectStoreURLs.get(cursor.value.hash).onsuccess = function(event)
        {
          var objURLs = event.target.result;
          objModel.url = objURLs.url;
          objModel.domain = objURLs.domain;
          objModel.last_access = (new Date(objURLs.last_access)).toLocaleString();
          objModel.last_access_date = new Date(objURLs.last_access);
          
          objContainer.push(objModel);
        }

        cursor.continue(); // exit and eventually call onsuccess again
      } 
      else 
      {
        // Sort pages by last access time
        objContainer.sort(function(a, b) {
          return Date.parse(b.last_access_date) - Date.parse(a.last_access_date);
        });

        // Pass objContainer to the view using KnockOut
        ko.applyBindings(new ViewModel(objContainer));
        
        // Functionality of 'remove' button
        $('.removePage').each(function(i, obj) {
          $(obj).on('click', function() {
            var cfm = confirm('Do you want to delete this page and add its URL to blacklist?');
            if (!cfm) {
              return;
            } else {
              var hash = $(this).attr('data-hash');
              $.when(
                deletePageFromURLs(hash),
                deletePageFromDailySessions(hash),
                deletePageFromOpenGraphData(hash)
              ).then(function() {
                location.reload();
              });
            }
          });
        });
        
        
        $('.removeDomain').each(function(i, obj) {
          $(obj).on('click', function() {
            var cfm = confirm('Do you want to delete this domain and add it to blacklist?');
            if (!cfm) {
              return;
            } else {
              var domain = $(this).attr('data-domain');
              $.when(
                removeDomain(domain)
              ).then(function() {
                location.reload();
              });
            }
          });
        });
        
        // Functionality of 'share' button
        addShare('fb', FB_SHARE_LINK);
        addShare('tw', TW_SHARE_LINK);
        addShare('ym', YM_SHARE_LINK);
      }
    };
  };  
});









































//document.addEventListener("DOMContentLoaded", function(event) {
//  var arr = getData();
//  arr.sort(function(a, b) {
//    return Date.parse(b.lastAccess) - Date.parse(a.lastAccess);
//  });
//  ko.applyBindings(new viewModel(getInterestingPages(arr)));
//  $('.removePage').each(function(i, obj) {
//    $(obj).on('click', function () {    
//      var cfm = confirm('Do you want to delete this page?');
//      if (!cfm) {
//        return;
//      } else {
//        var url = $(this).attr('url');
//        var arr = getData();
//        for (var i = 0; i < arr.length; i++) {
//          if (arr[i].pageURL === url) {
//            arr.splice(i, 1);
//            break;
//          }
//        }
//        localStorage['SmartHistory'] = JSON.stringify(arr);
//        location.reload();
//      }
//    });
//  });
//  
//  $('.removeDomain').each(function(i, obj) {
//    $(obj).on('click', function () {
//      var cfm = confirm('Do you want to delete all pages in this domain?');
//      if (!cfm) {
//        return;
//      } else {
//        var domain = $(this).attr('domain');
//        var arr = getData();
//        for (var i = 0; i < arr.length; i++) {
//          if (arr[i].pageDomain === domain) {
//            arr.splice(i--, 1);
//          }
//        }
//        localStorage['SmartHistory'] = JSON.stringify(arr);
//        location.reload();
//      }
//    });
//  });
//  
//  $('.fb').each(function(i, obj) {
//    var url = $(obj).attr('url');
//    $(obj).attr('href', 'https://www.facebook.com/sharer/sharer.php?u=' + url);
//    $(obj).on('click', function() {
//      window.open($(obj).attr('href'), 'SmartHistory', 'scrollbars=yes, width=630, height=560');
//    });
//  });
//
//  $('.tw').each(function(i, obj) {
//    var url = $(obj).attr('url');
//    $(obj).attr('href', 'https://twitter.com/intent/tweet?url=' + url);
//    $(obj).on('click', function() {
//      window.open($(obj).attr('href'), 'SmartHistory', 'scrollbars=yes, width=630, height=560');
//    });
//  });
//  
//  $('.ym').each(function(i, obj) {
//    var url = $(obj).attr('url');
//    $(obj).attr('href', 'https://www.yammer.com/home/bookmarklet?bookmarklet_pop=1&u=' + url);
//    $(obj).on('click', function() {
//      window.open($(obj).attr('href'), 'SmartHistory', 'scrollbars=yes, width=630, height=560');
//    });
//  });
//  
//});
//
//function viewModel(arr) {
//  this.itemsArr = ko.observableArray(arr);
//}
//
//function getData() {
//  var arr = JSON.parse(localStorage["SmartHistory"]);
//  return arr;
//}
//
//function secToTime(sec) {
//  var days = parseInt(sec / (3600 * 24));
//  var hours = parseInt(sec / 3600) % 24;
//  var minutes = parseInt(sec / 60) % 60;
//  var seconds = sec % 60;
//  var time = '';
//  if (sec > (3600*24)) {
//    time += days + 'd ';
//  }
//  if (sec > 3600) {
//    time += (hours < 10 ? '0' + hours : hours) + 'h ';
//  }
//  if (sec > 60) {
//    time += (minutes < 10 ? '0' + minutes : minutes) + 'm ';
//  }
//  time += (seconds < 10 ? '0' + seconds : seconds) + 's';
//  return time;
//}
//
//function extractDate(date_str) {
//  var date_obj = new Date(date_str);
//  return date_obj.toLocaleDateString();
//}
//
//function getInterestingPages(arr) {
//  var res = [];
//  for (var i = 0; i < arr.length; i++) {
//    if (arr[i].isInteresting) {
//      res.push(arr[i]);
//    }
//  }
//  return res;
//}
//
//
//
//
//
//
//
//
//
//
//
//
//
