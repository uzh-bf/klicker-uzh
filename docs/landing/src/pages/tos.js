import React from 'react'
import { Container } from 'semantic-ui-react'

import Layout from '../components/layouts/Layout'

export default () => (
  <Layout>
    <Container>
      <div className="terms">
        <h1>Terms of Service</h1>
        <p>
          <strong>Updated on August 1, 2018</strong>
        </p>
        <p>
          The Teaching Center of the Department of Banking and Finance at the
          University of Zurich (hereinafter "LICENSOR") provides this online
          service (hereinafter "ONLINE SERVICE") and licenses its use to you
          (hereinafter "YOU") under the following terms and conditions
          (hereinafter „AGREEMENT“).
        </p>

        <h2>License</h2>
        <p>
          LICENSOR grants YOU a royalty-free, worldwide, non-exclusive,
          non-transferable and non-commercial license to use the ONLINE SERVICE
          solely for education, evaluation, demonstration, and non-profit
          research purposes. The underlying software is released as-is under the
          terms of the AGPL-3.0 and may be used, modified, and distributed
          according to this license.
        </p>

        <h2>Term</h2>
        <p>
          This license becomes effective at the moment YOU are provided access
          to the ONLINE SERVICE by LICENSOR. The license is effective until
          terminated by LICENSOR. LICENSOR may terminate it at any time by
          removing access to the ONLINE SERVICE. It will also terminate the
          licence with immediate effect if YOU fail to comply with any term or
          condition of this AGREEMENT.
        </p>

        <h2>No Warranty / Indemnification</h2>
        <p>
          THIS ONLINE SERVICE IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED
          WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
          MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
          LICENSOR MAKES NO REPRESENTATION OR WARRANTY THAT THE ONLINE SERVICE
          OR THE USE OF THE ONLINE SERVICE WILL NOT INFRINGE ANY PATENT OR OTHER
          PROPRIETARY RIGHTS. IN NO EVENT SHALL LICENSOR BE LIABLE FOR ANY
          DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
          DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
          GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
          INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
          IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
          OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS ONLINE SERVICE,
          EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. LICENSOR DOES NOT
          WARRANT THAT THE ONLINE SERVICE WILL BE FREE OF DEFECTS, RUNS WITHOUT
          INTERRUPTION, IS SUITED FOR INTEROPERATION WITH OHTER PROGRAMS
          RESPECTIVELY FUNCTIONS IN COMBINATION WITH THE HARDWARE OR SOFTWARE
          PRODUCTS OF THIRD PARTIES, OR THAT PROGRAM ERRORS WILL BE CORRETED BY
          LICENSOR.
        </p>
        <p>
          YOU ARE RESPONSIBLE FOR THE SELECTION OF THE ONLINE SERVICE TO ACHIEVE
          ITS INTENDED RESULTS, USE OF THE ONLINE SERVICE, AND THE RESULTS
          OBTAINED THEREFROM. YOU AGREE TO INDEMNIFY AND HOLD LICENSOR AND ITS
          EMPLOYEES HARMLESS WITH RESPECT TO ALL CLAIMS BY THIRD PARTIES ARISING
          OUT OF YOUR USE OF THE SOFTWARE.
        </p>

        <h2>General</h2>
        <p>
          This AGREEMENT will be exclusively governed by the laws of
          Switzerland, under exclusion of the conflict of laws. YOU irrevocably
          agree to submit to the exclusive jurisdiction of the courts of Zurich,
          Switzerland, in respect of any dispute which arises.
        </p>
      </div>
    </Container>

    <style jsx>{`
      .terms {
        padding: 1rem 0;
      }
    `}</style>
  </Layout>
)
