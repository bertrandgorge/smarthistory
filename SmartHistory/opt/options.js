document.addEventListener('DOMContentLoaded', function(e) 
{
  var blacklist = JSON.parse(localStorage['Blacklist']);
  var whitelist = JSON.parse(localStorage['Whitelist']);

  var viewModel = function(b, w) {
    this.blacklist = ko.observableArray(b);
    this.whitelist = ko.observableArray(w);
  };

  ko.applyBindings(new viewModel(blacklist, whitelist));
  
  addFuntionalities('blacklist');
//  addFuntionalities('whitelist');
});

var addFuntionalities = function(name) {  
  var mark = '';
  var base = '';
  if (name === 'blacklist') {
    mark = 'b';
    base = 'Blacklist';
  } else if (name === 'whitelist') {
    mark = 'w';
    base = 'Whitelist';
  } else {
    return;
  }
  
  $('.delete-' + mark).each(function(i, obj) {
    $(obj).on('click', function() {
      var cfm = confirm('Do you want to delete this URL from ' + name + '?');
      if (!cfm) {
        return;
      } else {
        var arr = JSON.parse(localStorage[base]);
        var index = arr.indexOf($(this).attr('data-url'));
        if (index > -1) {
          arr.splice(index, 1);
          localStorage[base] = JSON.stringify(arr);
          location.reload();
        }
      }
    });
  });
  
  document.getElementById('submit-' + mark).onclick = function() {
    var data = document.getElementById('input-' + mark).value;
    if (validURL(data)) {
      var arr = JSON.parse(localStorage[base]);
      arr.unshift(data);
      localStorage[base] = JSON.stringify(arr);
      location.reload();
    }
  };
  
}

function validURL(url) {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
  '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
  '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
  '(\\#[-a-z\\d_]*)?$','i');
  if (pattern.test(url)) {
    var arr = JSON.parse(localStorage['Blacklist']);
    var index = arr.indexOf(url);
    if (index > -1) {
      alert('The URL already exists!');
      return false;
    } else {
      return true;
    }
  } else {
    alert('Please enter a valid URL!');
    return false;
  }
}









