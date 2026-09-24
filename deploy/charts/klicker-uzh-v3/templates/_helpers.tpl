{{/*
Expand the name of the chart.
*/}}
{{- define "chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "chart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "chart.labels" -}}
helm.sh/chart: {{ include "chart.chart" . }}
{{ include "chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}


{{/*
Ingress labels
*/}}
{{- define "chart.ingressLabels" -}}
{{ include "chart.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Scoped Doc Query KB route binding, shared by the chat and backend-graphql
consumers. All three values together switch the modern KB server to scope-token
transport authentication, which then ignores the stored bearer. Leaving all
empty keeps the legacy transport bearer; a partial configuration fails
rendering instead of silently keeping a stale credential in service.
*/}}
{{- define "chart.docQueryScopedMcpEnv" -}}
{{- $scopedMcp := (default dict .Values.docQuery).scopedMcp | default dict -}}
{{- $serverId := $scopedMcp.serverId | default "" -}}
{{- $legacyUrl := $scopedMcp.legacyUrl | default "" -}}
{{- $url := $scopedMcp.url | default "" -}}
{{- $configured := 0 -}}
{{- range $value := list $serverId $legacyUrl $url -}}
{{- if $value -}}{{- $configured = add $configured 1 -}}{{- end -}}
{{- end -}}
{{- if and (gt $configured 0) (lt $configured 3) -}}
{{- fail "docQuery.scopedMcp requires serverId, legacyUrl and url together" -}}
{{- end -}}
{{- if eq $configured 3 }}
DOC_QUERY_SCOPED_MCP_SERVER_ID: {{ $serverId | quote }}
DOC_QUERY_SCOPED_MCP_LEGACY_URL: {{ $legacyUrl | quote }}
DOC_QUERY_SCOPED_MCP_URL: {{ $url | quote }}
{{- end -}}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "chart.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "chart.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Frontend PWA pod annotations, shared by the baseline and burst Deployments.
*/}}
{{- define "chart.frontendPWAPodAnnotations" -}}
checksum/config: {{ include (print $.Template.BasePath "/cm-frontend-pwa.yaml") . | sha256sum }}
release: {{ .Chart.AppVersion }}
{{- with .Values.frontendPWA.podAnnotations }}
{{- toYaml . | nindent 0 }}
{{- end }}
{{- end }}

{{/*
Frontend PWA pod spec without node scheduling, shared by the baseline and burst
Deployments.
*/}}
{{- define "chart.frontendPWAPodSpec" -}}
priorityClassName: {{ include "chart.fullname" . }}-{{ .Values.frontendPWA.priorityClassName }}
{{- with .Values.frontendPWA.imagePullSecrets }}
imagePullSecrets:
  {{- toYaml . | nindent 2 }}
{{- end }}
securityContext:
  {{- toYaml .Values.frontendPWA.podSecurityContext | nindent 2 }}
containers:
  - name: frontend-pwa
    securityContext:
      {{- toYaml .Values.frontendPWA.securityContext | nindent 6 }}
    image: "{{ .Values.frontendPWA.image.repository }}:{{ .Values.global.imageTag | default .Values.frontendPWA.image.tag | default .Chart.AppVersion }}"
    imagePullPolicy: {{ .Values.frontendPWA.image.pullPolicy }}
    ports:
      - name: http
        containerPort: 3000
        protocol: TCP
    envFrom:
      - configMapRef:
          name: {{ include "chart.fullname" . }}-config-global
      - configMapRef:
          name: {{ include "chart.fullname" . }}-config-frontend-pwa
      - secretRef:
          name: {{ include "chart.fullname" . }}-secret-frontend-pwa
    livenessProbe:
      httpGet:
        path: /login
        port: http
    readinessProbe:
      httpGet:
        path: /login
        port: http
    resources:
      {{- toYaml .Values.frontendPWA.resources | nindent 6 }}
{{- end }}
