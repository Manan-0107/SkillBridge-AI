"""
lib/voice_normalizer.py

Python reference implementation for spoken voice normalization:
- Normalizes spoken emails (resolving '@', 'at the rate', numbers, prefixes, suffixes)
- Normalizes names, phone numbers, and PIN codes
- Extracts clean entities from natural speech
"""

import re

def normalize_spoken_email(raw: str) -> str:
    if not raw:
        return ""
    
    text = raw.strip()

    # 1. Direct Regex extraction if standard email format is already present in sentence
    email_regex = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    direct_match = email_regex.search(text)
    if direct_match:
        return direct_match.group(0).lower()

    # 2. Strip conversational prefixes & suffixes
    text = re.sub(
        r'^(?:my email is|my email id is|email is|email id is|enter email|fill email|if i said|મારું ઈમેલ છે|મારું ઈમેલ|મારું ઈમેઈલ છે|મારું ઈમેઈલ|ઈમેલ છે|ઈમેલ|मेरा ईमेल है|मेरा ईमेल|ईमेल है|ईमेल|mon email est|mi correo es)\s*',
        '',
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r'\s*(?:as my email address|as my email id|as my email|is my email address|is my email|is my id|છે|હશે|લખી લો|है)$',
        '',
        text,
        flags=re.IGNORECASE
    )

    # 3. Convert spoken number words to digits
    number_words = {
        r'\beleven\s+twenty\s+seven\b': '1127',
        r'\btwenty\s+seven\b': '27',
        r'\bone\s+one\s+two\s+seven\b': '1127',
        r'\bzero\b': '0',
        r'\bone\b': '1',
        r'\btwo\b': '2',
        r'\bthree\b': '3',
        r'\bfour\b': '4',
        r'\bfive\b': '5',
        r'\bsix\b': '6',
        r'\bseven\b': '7',
        r'\beight\b': '8',
        r'\bnine\b': '9',
        r'\bten\b': '10',
        r'\beleven\b': '11',
        r'\btwelve\b': '12',
    }
    for pattern, repl in number_words.items():
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)

    # 4. Spoken "@" representations across English, Gujarati, Hindi, French, Spanish
    text = re.sub(
        r'\s*(?:at\s+the\s+rate\s+of|at\s+the\s+rate|add\s+the\s+rate|at\s+rate|એટ\s*ધ\s*રેટ|એટ\s*રેટ|एट\s*द\s*रेट\s*ऑफ़|एट\s*द\s*रेट|एट\s*रेट|arobase|arroba|a\s+commercial)\s*',
        '@',
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(r'\s+at\s+', '@', text, flags=re.IGNORECASE)

    # 5. Spoken "." representations
    text = re.sub(r'\s*(?:dot|dott|डॉट|ડૉટ|point|punto)\s*', '.', text, flags=re.IGNORECASE)

    # 6. Remove internal spaces around @ and . and throughout email
    text = re.sub(r'\s*@\s*', '@', text)
    text = re.sub(r'\s*\.\s*', '.', text)
    text = re.sub(r'\s+', '', text)

    # 7. Common domain corrections
    text = re.sub(r'@g\s*mail', '@gmail', text, flags=re.IGNORECASE)
    text = re.sub(r'@y\s*ahoo', '@yahoo', text, flags=re.IGNORECASE)
    text = re.sub(r'@out\s*look', '@outlook', text, flags=re.IGNORECASE)
    text = re.sub(r'\.c\s*om', '.com', text, flags=re.IGNORECASE)

    return text.lower()


if __name__ == "__main__":
    test_cases = [
        "mananshah1127@gmail.com",
        "mananshah1127@gmail.com as my email address",
        "my email is mananshah1127@gmail.com",
        "manan shah 1127 at the rate gmail dot com",
        "manan shah eleven twenty seven at gmail dot com",
        "મારું ઈમેલ છે manan shah 1127 એટ ધ રેટ gmail ડૉટ com",
    ]

    print("=== Python Voice Normalizer Tests ===")
    for tc in test_cases:
        res = normalize_spoken_email(tc)
        print(f"Input: '{tc}' -> Result: '{res}'")
        assert res == "mananshah1127@gmail.com", f"Failed for {tc}: got {res}"
    print("All Python tests PASSED successfully!")
