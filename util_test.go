package main

import "testing"

func TestTrimSpaceLineRight(t *testing.T) {
	tests := []string{
		"", "",
		"a", "a",
		"a\n", "a",
		"\na", "\na",
		"ab\r", "ab",
	}

	n := len(tests) / 2
	for i := 0; i < n; i++ {
		test := tests[i*2]
		exp := tests[i*2+1]
		got := trimSpaceLineRight(test)
		if got != exp {
			t.Errorf("for '%s', got: '%s', expected: '%s'", test, got, exp)
		}
	}
}
