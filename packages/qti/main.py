from jinja2 import Environment, FileSystemLoader, select_autoescape
from lxml import etree
from pathlib import Path

# xsd_parser = etree.XMLParser()

# current_dir = Path(__file__).parent
# schema_path = current_dir / "imsqti_v2p1p2.xsd"

# schema_root = etree.parse(str(schema_path), parser=xsd_parser)
# schema = etree.XMLSchema(schema_root)


# def validate_xml(string):
#     tree = etree.fromstring(string, parser=xsd_parser)
#     is_valid = schema.validate(tree)
#     return is_valid


def persist_output(string, output_file):
    # if validate_xml(string) is False:
    #     raise Exception("Invalid XML")

    with open(output_file, "w") as f:
        f.write(string)


def process_sc_item(item):
    return {
        **item,
        "correct_response_id": filter(
            lambda option: option["correct"], item["options"]
        ),
    }


def process_item(item):
    if item["type"] == "SC" or item["type"] == "MC":
        options = list(
            map(
                lambda item: {**item[1], "identifier": f"opt{item[0]}"},
                enumerate(item["options"]),
            )
        )

        correct_response = list(
            map(
                lambda item: item["identifier"],
                filter(lambda option: option["correct"], options),
            )
        )

        return {**item, "options": options, "correct_response": correct_response}

    if item["type"] == "KPRIM":
        options = list(
            map(
                lambda item: {**item[1], "identifier": f"opt{item[0]}"},
                enumerate(item["options"]),
            )
        )

        correct_response = list(
            map(
                lambda item: f"{item["identifier"]} {'correct' if item['correct'] else 'wrong'}",
                options,
            )
        )

        return {
            **item,
            "options": options,
            "correct_response": correct_response,
        }

    if item["type"] == "NUMERICAL":
        return {**item}

    if item["type"] == "FREE_TEXT":
        return {**item}

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
        "identifier": "itemFREE_TEXT",
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

template_manifest = env.get_template("imsmanifest.xml.jinja")

out_manifest = template_manifest.render(items=ITEMS)
print(out_manifest)

persist_output(out_manifest, "out/imsmanifest.xml")

template_test = env.get_template("test.xml.jinja")

out_test = template_test.render(title="Test", items=ITEMS)
print(out_test)

persist_output(out_test, "out/test.xml")

for item in ITEMS:
    template_item = env.get_template(f"item{item['type']}.xml.jinja")
    processed_item = process_item(item)
    out_item = template_item.render(item=processed_item)
    print(out_item)

    persist_output(out_item, f"out/item{item['type']}.xml")
