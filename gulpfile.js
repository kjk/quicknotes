// Pre-requisites: need to install all the npm modules with:
// npm install

// TODO:
// - use gulp-uglify for prod to minifiy javascript:
//   var uglify= require('gulp-uglify');
//   .pipe(uglify())
// - concat js files see http://www.hongkiat.com/blog/getting-started-with-gulp-js/

var browserify  = require('browserify');
var exorcist    = require('exorcist')
var gulp        = require('gulp');
var prefix      = require('gulp-autoprefixer');
var concat      = require('gulp-concat');
var htmlreplace = require('gulp-html-replace');
var uglify      = require('gulp-uglify');
var react       = require('gulp-react');
var rename      = require('gulp-rename');
var sass        = require('gulp-sass');
var streamify   = require('gulp-streamify');
var source      = require('vinyl-source-stream');
var sourcemaps  = require('gulp-sourcemaps');
var watchify    = require('watchify');
var reactify    = require('reactify');

gulp.task('js', function() {
  browserify({
    entries: ['jsx/App.jsx'],
    transform: [reactify],
    debug: true
  })
    .bundle()
    .pipe(exorcist('s/dist/bundle.js.map'))
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('s/dist'))
});

gulp.task('css', function() {
  return gulp.src('./sass/main.scss')
  .pipe(sourcemaps.init())
  .pipe(sass().on('error', sass.logError))
  .pipe(prefix('last 2 versions'))
  .pipe(sourcemaps.write('.')) // this is relative to gulp.dest()
  .pipe(gulp.dest('./s/dist/'));
});

gulp.task('watch', function() {
  gulp.watch('jsx/*', ['js']);
  gulp.watch('./sass/**/*', ['css']);
});

gulp.task('default', ['css', 'js']);

gulp.task('build_and_watch', ['default', 'watch']);
