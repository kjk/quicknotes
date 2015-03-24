package main

import (
	"bytes"
	"fmt"
	"regexp"

	"github.com/kjk/u"
)

var langToPrettifyLangMap = map[string]string{
	"c":          "c",
	"c++":        "cc",
	"cpp":        "cpp",
	"python":     "py",
	"html":       "html",
	"xml":        "xml",
	"perl":       "pl",
	"c#":         "cs",
	"javascript": "js",
	"java":       "java",
}

func langToPrettifyLang(lang string) string {
	//from http://google-code-prettify.googlecode.com/svn/trunk/README.html
	//"bsh", "c", "cc", "cpp", "cs", "csh", "cyc", "cv", "htm", "html",
	//"java", "js", "m", "mxml", "perl", "pl", "pm", "py", "rb", "sh",
	//"xhtml", "xml", "xsl"
	if l, ok := langToPrettifyLangMap[lang]; ok {
		return fmt.Sprintf("lang-%s", l)
	}
	return ""
}

func txtCookie(s string) string {
	return u.Sha1HexOfBytes([]byte(s))
}

var reCode = regexp.MustCompile("(?siU)<code.*>.+</code>")

func extractLang(s []byte) (rest, lang []byte) {
	for len(s) > 0 {
		if s[0] != ' ' {
			break
		}
		s = s[1:]
	}
	i := bytes.IndexByte(s, '>')
	if 0 == i {
		return s[1:], nil
	}
	return s[i+1:], s[:i]
}

func txtWithCodeParts(txt []byte) ([]byte, map[string][]byte) {
	codeParts := make(map[string][]byte)
	res := reCode.ReplaceAllFunc(txt, func(s []byte) []byte {
		s = s[len("<code") : len(s)-len("</code>")]
		s, lang := extractLang(s)
		newCode := ""
		if lang != nil {
			l := langToPrettifyLang(string(lang))
			newCode = fmt.Sprintf(`<pre class="prettyprint %s">%s</pre>`, l, string(s))
		} else {
			newCode = fmt.Sprintf(`<pre class="prettyprint">%s</pre>`, string(s))
		}
		cookie := txtCookie(newCode)
		codeParts[cookie] = []byte(newCode)
		return []byte(cookie)
	})
	return res, codeParts
}
