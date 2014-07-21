var gulp = require('gulp');
var $ = require('gulp-load-plugins')({lazy: false});
var source = require('vinyl-source-stream');
var browserify = require('browserify');

var paths = {
  entry: './js/main.js',
  scripts: './js/**/*.js',
  styles: './styles',
  bin: '../bin'
};

gulp.task('build_js', ['lint'], function() {
  return browserify(paths.entry)
    .bundle()
    .pipe(source('sweep.js'))
    .pipe(gulp.dest(paths.bin))
    .pipe($.rename('sweep.min.js'))
    .pipe($.streamify( $.uglify() ))
    .pipe(gulp.dest(paths.bin))
    .pipe($.size())
});

gulp.task('lint', function() {
  return gulp.src(paths.scripts)
    .pipe($.jshint())
    .pipe($.jshint.reporter('default'))
});

gulp.task('styles', function() {
  return false;
});

gulp.task('watch_files', function() {
  gulp.watch(paths.scripts, ['scripts']);
  gulp.watch(paths.styles, ['styles']);
});

//gulp.task('gh_pages', ['default'], function () {
//  gulp.src(paths.dist.root + '/**/*')
//    .pipe($.ghPages('https://github.com/rileyjshaw/own-this-website.git', 'origin'));
//});

gulp.task('scripts', ['build_js', 'lint']);
gulp.task('default', ['scripts', 'styles']);

// These are the ones you'll want to call.
//
// Be very careful using clean_bin; since force
// is set to true, it has the potential to delete
// anything in your filesystem. You've been warned!
gulp.task('clean_bin', function () {
  return gulp.src(paths.bin, {read: false})
    .pipe($.clean({force: true})); // !!!
});
gulp.task('watch', ['default', 'watch_files']);
// gulp.task('deploy', ['default', 'gh_pages']);
