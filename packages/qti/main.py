from jinja2 import Environment, FileSystemLoader, select_autoescape


def process_sc_item(item):
    return {
        **item,
        "correct_response_id": filter(
            lambda option: option["correct"], item["options"]
        ),
    }


def process_item(item):
    return {**item}


ITEMS = [
    {
        "identifier": "itemSC",
        "type": "SC",
        "title": "Meaning of Life",
        "content": "What is the meaning of life?",
        "explanation": "The meaning of life is a question that has puzzled philosophers for centuries. It is a question that has been debated by scholars, scientists, and thinkers for millennia. The meaning of life is a question that has been explored by many different cultures and traditions. The meaning of life is a question that has been explored by many different cultures and traditions.",
        "options": [
            {
                "content": "31",
                "correct": False,
                "feedback": "Incorrect!",
            },
            {
                "content": "42",
                "correct": True,
                "feedback": "Correct!",
            },
            {
                "content": "43",
                "correct": False,
                "feedback": "Incorrect!",
            },
        ],
    },
    {
        "identifier": "itemMC",
        "type": "MC",
        "title": "The Sun",
        "content": "What is the sun?",
        "explanation": "The sun is a star that is located in the sky and is the source of light and heat for the Earth. The sun is a star that is located in the sky and is the source of light and heat for the Earth. The sun is a star that is located in the sky and is the source of light and heat for the Earth.",
        "options": [
            {
                "content": "A star",
                "correct": True,
                "feedback": "Correct!",
            },
            {
                "content": "A planet",
                "correct": False,
                "feedback": "Incorrect!",
            },
            {
                "content": "A galaxy",
                "correct": False,
                "feedback": "Incorrect!",
            },
            {
                "content": "Very hot",
                "correct": True,
                "feedback": "Correct!",
            },
        ],
    },
    {
        "identifier": "itemKPRIM",
        "type": "KPRIM",
        "title": "Capital of France",
        "content": "What is a valid statement about the capital of France?",
        "explanation": "The capital of France is Paris. The capital of France is Paris. The capital of France is Paris.",
        "options": [
            {
                "content": "Paris is the capital of France",
                "correct": True,
                "feedback": "Correct!",
            },
            {
                "content": "Paris is not the capital of France",
                "correct": False,
                "feedback": "Incorrect!",
            },
            {
                "content": "They speak French in Paris",
                "correct": True,
                "feedback": "Correct!",
            },
            {
                "content": "Paris is a canton of Switzerland",
                "correct": False,
                "feedback": "Incorrect!",
            },
        ],
    },
    {
        "identifier": "itemTEXT",
        "type": "FREE_TEXT",
        "title": "Best Canton",
        "content": "What is the best canton of Switzerland?",
        "explanation": "This question is a bit hard to answer.",
        "options": {
            "min_length": 1,
            "max_length": 100,
        },
    },
    {
        "identifier": "itemNUMERICAL",
        "type": "NUMERICAL",
        "title": "Number of Cantons",
        "content": "How many cantons are there in Switzerland?",
        "explanation": "There are 26 cantons in Switzerland.",
        "options": {
            "min": 0,
            "max": 100,
            "accuracy": 0,
        },
    },
]

env = Environment(
    loader=FileSystemLoader("./templates"), autoescape=select_autoescape()
)

template = env.get_template("imsmanifest.xml.jinja")

out_manifest = template.render(items=ITEMS)
print(out_manifest)

with open("out/imsmanifest.xml", "w") as f:
    f.write(out_manifest)

template = env.get_template("test.xml.jinja")

out_test = template.render(items=ITEMS)
print(out_test)

with open("out/test.xml", "w") as f:
    f.write(out_manifest)

template = env.get_template("itemSC.xml.jinja")

for item in ITEMS:
    template = env.get_template(f"item{item['type']}.xml.jinja")
    out_item = template.render(item=item)
    print(out_item)

    with open(f"out/item{item['type']}.xml", "w") as f:
        f.write(out_item)
