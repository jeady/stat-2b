module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    lint: {
      all: ['grunt.js', 'lib/*.js']
    },
    concat: {
      all: {
        src: ['lib/*.js', 'vendor/**/*.js'],
        dest: 'sticigui.js'
      }
    },
    min: {
      all: {
        src: 'sticigui.js',
        dest: 'sticigui.js'
      }
    }
  });


  grunt.registerTask('default', 'lint concat min');
  grunt.registerTask('debug', 'lint concat');

};
