$.ready = function(fn){
  if(document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
};
$.ready(function(){
  $('.card').on('click', function(){
    this.classList.toggle('fade-in');
  });
});
