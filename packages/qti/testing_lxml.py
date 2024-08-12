from lxml import etree
from io import BytesIO

# Example QTI assessment item XML content
qti_xml = """<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd"
    identifier="flying-animals-item" title="Flying Animals">

    <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
        <correctResponse>
            <value>choice_b</value>
            <value>choice_d</value>
        </correctResponse>
    </responseDeclaration>

    <itemBody>
        <choiceInteraction responseIdentifier="RESPONSE" maxChoices="0">
            <prompt>Which animals can fly?</prompt>
            <simpleChoice identifier="choice_a">Crocodiles
                <feedbackInline outcomeIdentifier="FEEDBACK">No, crocodiles cannot fly!</feedbackInline>
            </simpleChoice>
            <simpleChoice identifier="choice_b">Eagles
                <feedbackInline outcomeIdentifier="FEEDBACK">Yes, eagles can fly!</feedbackInline>
            </simpleChoice>
            <simpleChoice identifier="choice_c">Kangaroos
                <feedbackInline outcomeIdentifier="FEEDBACK">No kangaroos cannot fly!</feedbackInline>
            </simpleChoice>
            <simpleChoice identifier="choice_d">Butterflies
                <feedbackInline outcomeIdentifier="FEEDBACK">Yes, butterflies can fly!</feedbackInline>
            </simpleChoice>
            <simpleChoice identifier="choice_e">Dogs
                <feedbackInline outcomeIdentifier="FEEDBACK">No, dogs cannot fly!</feedbackInline>
            </simpleChoice>
        </choiceInteraction>
    </itemBody>
</assessmentItem>"""

# Parse the XML content
parser = etree.XMLParser(remove_blank_text=True)
tree = etree.parse(BytesIO(qti_xml.encode("utf-8")), parser)
root = tree.getroot()

# Print basic information about the assessment item
print(f"Assessment Item ID: {root.get('identifier')}")
print(f"Title: {root.get('title')}")

# Extract correct responses
correct_responses = root.xpath(".//correctResponse/value/text()")
print(f"Correct Responses: {', '.join(correct_responses)}")

# Extract question prompt
prompt = root.xpath(".//prompt/text()")[0]
print(f"Question Prompt: {prompt}")

# Extract choices and their feedback
choices = root.xpath(".//simpleChoice")
for choice in choices:
    choice_id = choice.get("identifier")
    choice_text = choice.text.strip()
    feedback = choice.xpath(".//feedbackInline/text()")[0]
    print(f"Choice {choice_id}: {choice_text}")
    print(f"  Feedback: {feedback}")

# Validate against QTI 2.1 schema
xsd_parser = etree.XMLParser()
schema_root = etree.parse("./imsqti_v2p1p1.xsd", parser=xsd_parser)
schema = etree.XMLSchema(schema_root)
is_valid = schema.validate(tree)
print(f"Is valid QTI 2.1: {is_valid}")
