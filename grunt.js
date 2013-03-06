module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-css');

  // Project configuration.
  grunt.initConfig({
    lint: {
      js: ['grunt.js', 'lib/*.js']
    },
    csslint: {
      css: 'lib/*.css'
    },
    concat: {
      js: {
        src: ['lib/*.js', 'vendor/**/*.js'],
        dest: 'sticigui.js'
      },
      css: {
        src: ['lib/*.css', 'vendor/**/*.css'],
        dest: 'sticigui.css'
      }
    },
    min: {
      js: {
        src: 'sticigui.js',
        dest: 'sticigui.min.js'
      }
    },
    cssmin: {
      css: {
        src: 'sticigui.css',
        dest: 'sticigui.min.css'
      }
    },
    jshint: {
      options: {
        sub: true
      },
      globals: {
        jQuery: true,
        d3: true
      }
    }
  });

  // Currently we cannot use csslint because we depend on using SVG CSS
  // properties such as 'fill' and 'stroke'. When csslint eventually supports
  // SVG CSS properties (i.e. https://github.com/nzakas/parser-lib/issues/28 is
  // closed), we should add csslint to the list of tasks to perform.
  // TODO(jmeady): add csslint.
  grunt.registerTask('default', 'lint concat min cssmin');
  grunt.registerTask('debug', 'default');

};
