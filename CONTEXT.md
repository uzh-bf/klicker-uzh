# Assessment Identity Context

This context names the identity boundary for formal assessment participation.

The edu-ID release approval covers the required email, unique ID, surname, and
given name claims, plus the desired matriculation number and linked-affiliation
claims. This feature consumes the name and matriculation claims for assessment
identity; the existing account and affiliation flows remain the owners of the
other approved claims.

## Language

**Assessment course**: A course whose participant results are used as formal
assessment records and grade-matching inputs.

**Assessment participation identity**: The given name, surname, and
matriculation number associated with one person's participation in one
assessment course. It is asserted by the person's verified SWITCH edu-ID login,
may be incomplete when edu-ID does not release an attribute, and does not
belong to ordinary-course participation or to the global participant account.

**Invitation roster identity**: Identity information supplied by an assessment
course's invitation or roster. It remains distinct from the identity asserted
by edu-ID so that matching, missing values, and conflicts are visible rather
than silently resolved.

**Public credential verification**: The bearer-token page that verifies an
assessment credential. Its public identity projection contains only the
student's full name, composed from given name and surname; it never contains
email or matriculation number.

## Boundary rules

- Assessment participation identity is retained only for assessment
  participation and is nullable elsewhere.
- The Manage interface does not display these identity attributes for now.
- Assessment exports and the student's private credential download are the
  intended consumers; public verification is a deliberately smaller projection.
